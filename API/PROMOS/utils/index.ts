import mongoose from 'mongoose';
import { Promo, type IPromo, type IPromoDocument } from '../models/index.js';
import { Product } from '../../PRODUCTS/models/index.js';
import { publishNotificationDispatch } from '../../../CORE/services/kafka/index.js';
import { logger } from '../../../CORE/services/logger/index.js';
import { AppError } from '../../../CORE/handlers/error/index.js';
export type ResolvedPromo = {
    promoId: mongoose.Types.ObjectId;
    title: string;
    type: 'percentage' | 'fixed';
    value: number;
    effectiveDiscountAmount: number;
    source: 'vendor' | 'admin';
};

export type ResolvedLogisticsPromo = {
    promoId: mongoose.Types.ObjectId;
    title: string;
    discountAmount: number;
    source: 'admin';
};

export const isPromoLive = (promo: Pick<IPromo, 'status' | 'approvalStatus' | 'startsAt' | 'endsAt' | 'currentRedemptions' | 'maxTotalRedemptions'>): boolean => {
    const now = new Date();
    if (promo.status !== 'active') return false;
    if (promo.approvalStatus !== 'approved') return false;
    if (promo.startsAt > now) return false;
    if (promo.endsAt && promo.endsAt < now) return false;
    if (promo.maxTotalRedemptions !== undefined && promo.currentRedemptions >= promo.maxTotalRedemptions) return false;
    return true;
};

const computeDiscountAmount = (
    unitPrice: number,
    promo: Pick<IPromo, 'type' | 'value' | 'maxDiscountPerItem'>,
): number => {
    let discount =
        promo.type === 'percentage'
            ? Number(((unitPrice * promo.value) / 100).toFixed(2))
            : Math.min(unitPrice, promo.value);

    if (promo.maxDiscountPerItem !== undefined) {
        discount = Math.min(discount, promo.maxDiscountPerItem);
    }

    return discount;
};

export const resolveEffectivePromo = async (
    product: { _id: mongoose.Types.ObjectId; vendorId: mongoose.Types.ObjectId; category: string; activePromoId?: mongoose.Types.ObjectId; pricing: { amount: number } },
): Promise<ResolvedPromo | null> => {
    const unitPrice = product.pricing.amount;
    const now = new Date();
    const candidates: Array<{ promo: IPromoDocument; discount: number }> = [];

    if (product.activePromoId) {
        const vendorPromo = await Promo.findById(product.activePromoId).lean();
        if (vendorPromo && isPromoLive(vendorPromo)) {
            candidates.push({ promo: vendorPromo as IPromoDocument, discount: computeDiscountAmount(unitPrice, vendorPromo) });
        }
    }

    const adminPromos = await Promo.find({
        status: 'active',
        approvalStatus: 'approved',
        creatorRole: 'admin',
        isLogisticsPromo: false,
        startsAt: { $lte: now },
        $and: [
            { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
            {
                $or: [
                    { productIds: product._id },
                    { categories: product.category },
                    { applyPlatformWide: true },
                ],
            },
        ],
    }).lean();

    for (const ap of adminPromos) {
        if (!isPromoLive(ap)) continue;

        const requiresVendorOptIn = ap.scope === 'platform' || ap.scope === 'category';
        if (requiresVendorOptIn) {
            const application = ap.vendorApplications.find(
                (entry) => String(entry.vendorId) === String(product.vendorId),
            );
            if (!application || application.applicationStatus !== 'approved') {
                continue;
            }
        }

        candidates.push({ promo: ap as IPromoDocument, discount: computeDiscountAmount(unitPrice, ap) });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.discount - a.discount);
    const best = candidates[0]!;

    return {
        promoId: best.promo._id as mongoose.Types.ObjectId,
        title: best.promo.title,
        type: best.promo.type,
        value: best.promo.value,
        effectiveDiscountAmount: best.discount,
        source: best.promo.creatorRole,
    };
};

export const resolveLogisticsPromo = async (
    category: string,
    countryCode?: string,
    baseShippingAmount = 0,
): Promise<ResolvedLogisticsPromo | null> => {
    const now = new Date();

    const promos = await Promo.find({
        status: 'active',
        approvalStatus: 'approved',
        isLogisticsPromo: true,
        startsAt: { $lte: now },
        $and: [
            { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
            {
                $or: [
                    { applyPlatformWide: true },
                    { categories: category },
                    ...(countryCode ? [{ logisticsRegions: countryCode }] : []),
                ],
            },
        ],
    }).lean();

    const live = promos.filter(isPromoLive);
    if (live.length === 0) return null;

    const candidates = live.map((p) => {
        let discount =
            p.type === 'percentage'
                ? Number(((baseShippingAmount * p.value) / 100).toFixed(2))
                : Math.min(baseShippingAmount, p.value);
        if (p.maxShippingDiscountAmount !== undefined) {
            discount = Math.min(discount, p.maxShippingDiscountAmount);
        }
        return { promo: p, discount };
    });

    candidates.sort((a, b) => b.discount - a.discount);
    const best = candidates[0]!;

    return {
        promoId: best.promo._id as mongoose.Types.ObjectId,
        title: best.promo.title,
        discountAmount: best.discount,
        source: 'admin',
    };
};

export const notifyVendorsOfAdminPromo = async (promo: IPromoDocument): Promise<void> => {
    const productIds = promo.productIds ?? [];
    let products: Array<{ vendorId: mongoose.Types.ObjectId; name: string; _id: mongoose.Types.ObjectId }> = [];

    if (productIds.length > 0) {
        products = await Product.find({ _id: { $in: productIds } }).select('vendorId name').lean() as any;
    } else if (promo.categories.length > 0) {
        products = await Product.find({ category: { $in: promo.categories }, status: 'active' }).select('vendorId name').lean() as any;
    } else if (promo.applyPlatformWide) {
        products = await Product.find({ status: 'active' }).select('vendorId name').lean() as any;
    }

    const vendorProductMap = new Map<string, string[]>();
    for (const p of products) {
        const vid = String(p.vendorId);
        if (!vendorProductMap.has(vid)) vendorProductMap.set(vid, []);
        vendorProductMap.get(vid)!.push(p.name);
    }

    for (const [vendorId, productNames] of vendorProductMap) {
        const body = `A platform promotion "${promo.title}" has been applied to your product(s): ${productNames.join(', ')}. Buyers will see the discounted price at checkout.`;

        publishNotificationDispatch({
            userId: vendorId,
            category: 'all',
            title: `Platform promo applied: "${promo.title}"`,
            body,
            accent: 'info',
            metadata: {
                promoId: String(promo._id),
                promoTitle: promo.title,
            },
        }).catch((err) => logger.error({ err, vendorId }, '[PromoUtils] Vendor notification dispatch failed'));
    }
};
export const incrementPromoRedemption = async (promoId: mongoose.Types.ObjectId): Promise<void> => {
    await Promo.findByIdAndUpdate(promoId, { $inc: { currentRedemptions: 1 } });
};

export const validatePromoCode = async (
    code: string,
    productId: string,
    category: string,
): Promise<IPromoDocument> => {
    const now = new Date();
    const promo = await Promo.findOne({
        code: code.toUpperCase(),
        status: 'active',
        approvalStatus: 'approved',
        startsAt: { $lte: now },
        $and: [
            { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
            {
                $or: [
                    { productIds: new mongoose.Types.ObjectId(productId) },
                    { categories: category },
                    { applyPlatformWide: true },
                ],
            },
        ],
    });

    if (!promo) throw new AppError('Invalid or expired promo code.', 400);
    if (!isPromoLive(promo)) throw new AppError('This promo is no longer valid.', 400);

    return promo;
};
