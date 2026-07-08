import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES, ROLE_NAMES, USER_TYPES } from '../../../../CORE/utils/constants/index.js';
import { Promo } from '../../models/index.js';
import { User } from '../../../AUTH/models/index.js';
import { notifyVendorsOfAdminPromo } from '../../utils/index.js';
import { getVendorPerformanceMetrics, vendorMeetsPromoCriteria } from '../../utils/vendorMetrics.js';

export const createPromoController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const userId = String(sessionUser.id ?? sessionUser._id);
        const dbUser = await User.findById(userId).select('role userType').lean();
        const userRole = String(dbUser?.role ?? '').toLowerCase();
        const userType = String(dbUser?.userType ?? '').toLowerCase();
        const isAdmin = userRole === ROLE_NAMES.ADMIN || userRole === ROLE_NAMES.SUPER_ADMIN;
        const isVendor = userType === USER_TYPES.VENDOR;

        if (!isAdmin && !isVendor) throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);

        const body = await c.req.json();
        const {
            title, description, code, type, value, currency, scope,
            productIds, categories, applyPlatformWide, isLogisticsPromo,
            logisticsRegions, maxShippingDiscountAmount, maxDiscountPerItem,
            maxCategoriesApplied,             maxTotalRedemptions, maxRedemptionsPerUser,
            startsAt, endsAt, eligibilityCriteria,
        } = body;

        if (!title || !type || value === undefined || !scope || !startsAt) {
            throw new AppError('title, type, value, scope, and startsAt are required.', 400);
        }

        if (!['percentage', 'fixed'].includes(type)) {
            throw new AppError('type must be "percentage" or "fixed".', 400);
        }

        if (type === 'percentage' && (value <= 0 || value > 100)) {
            throw new AppError('Percentage promo value must be between 1 and 100.', 400);
        }

        if (!['product', 'category', 'platform', 'logistics'].includes(scope)) {
            throw new AppError('Invalid promo scope.', 400);
        }

        if (!isAdmin && scope !== 'product') {
            throw new AppError('Vendors can only create product-scoped promos. To join a platform promo, use the apply-to-platform-promo endpoint.', 403);
        }

        if (type === 'fixed' && !currency) {
            throw new AppError('currency is required for fixed-amount promos.', 400);
        }

        if (currency) {
            const { isSupportedCurrency } = await import('../../../../CORE/utils/constants/index.js');
            if (!isSupportedCurrency(currency.toUpperCase())) {
                throw new AppError(`Unsupported currency: ${currency}. Check GET /currency/detect for the list.`, 400);
            }
        }

        if (code) {
            const existing = await Promo.findOne({ code: code.toUpperCase(), status: 'active' });
            if (existing) throw new AppError('A promo with this code already exists.', 409);
        }

        const resolvedProductIds = (productIds ?? []).filter(mongoose.isValidObjectId).map(
            (id: string) => new mongoose.Types.ObjectId(id),
        );

        const promo = await Promo.create({
            createdBy: new mongoose.Types.ObjectId(userId),
            creatorRole: isAdmin ? 'admin' : 'vendor',
            scope,
            title: title.trim(),
            ...(description ? { description: description.trim() } : {}),
            ...(code ? { code: code.trim().toUpperCase() } : {}),
            type,
            value: Number(value),
            ...(currency ? { currency: currency.trim().toUpperCase() } : {}),
            productIds: resolvedProductIds,
            categories: categories ?? [],
            applyPlatformWide: Boolean(applyPlatformWide),
            isLogisticsPromo: Boolean(isLogisticsPromo),
            logisticsRegions: logisticsRegions ?? [],
            ...(maxShippingDiscountAmount !== undefined ? { maxShippingDiscountAmount } : {}),
            ...(maxDiscountPerItem !== undefined ? { maxDiscountPerItem } : {}),
            ...(maxCategoriesApplied !== undefined ? { maxCategoriesApplied } : {}),
            ...(maxTotalRedemptions !== undefined ? { maxTotalRedemptions } : {}),
            ...(maxRedemptionsPerUser !== undefined ? { maxRedemptionsPerUser } : {}),
            ...(eligibilityCriteria && typeof eligibilityCriteria === 'object'
                ? {
                      eligibilityCriteria: {
                          ...(eligibilityCriteria.minWatchHours !== undefined
                              ? { minWatchHours: Number(eligibilityCriteria.minWatchHours) }
                              : {}),
                          ...(eligibilityCriteria.minSalesCount !== undefined
                              ? { minSalesCount: Number(eligibilityCriteria.minSalesCount) }
                              : {}),
                      },
                  }
                : {}),
            startsAt: new Date(startsAt),
            ...(endsAt ? { endsAt: new Date(endsAt) } : {}),
            status: 'active',
            approvalStatus: 'approved',
        });

        logger.info({ promoId: promo._id, userId, scope }, '[Promos] Promo created');

        if (isAdmin) {
            notifyVendorsOfAdminPromo(promo).catch((err) =>
                logger.error({ err }, '[Promos] Failed to notify vendors'),
            );
        }

        return ResponseHandler.success(c, SYSTEM_MESSAGES.SUCCESS.PROMO_CREATED, { promo }, undefined, 201);
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, '[Promos] Failed to create promo');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.PROMO_CREATE_FAILED, 500);
    }
};

export const applyToPlatformPromoController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const userId = sessionUser.userId;
        const dbUser = await User.findById(userId).select('role userType').lean();
        if (String(dbUser?.userType ?? '').toLowerCase() !== USER_TYPES.VENDOR) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const promoId = c.req.param('promoId');
        if (!mongoose.isValidObjectId(promoId)) throw new AppError('Invalid promoId.', 400);

        const promo = await Promo.findById(promoId);
        if (!promo) throw new AppError(SYSTEM_MESSAGES.ERRORS.PROMO_NOT_FOUND, 404);

        if (promo.creatorRole !== 'admin') {
            throw new AppError('Only platform promos created by admins can be applied to.', 400);
        }

        if (promo.approvalStatus !== 'approved' || promo.status !== 'active') {
            throw new AppError('This platform promo is not currently active.', 400);
        }

        const metrics = await getVendorPerformanceMetrics(userId);
        if (!vendorMeetsPromoCriteria(metrics, promo.eligibilityCriteria)) {
            throw new AppError(
                `You do not meet promo criteria yet (${metrics.salesCount} sales, ${metrics.watchHours} stream hours).`,
                403,
            );
        }

        const vendorObjectId = new mongoose.Types.ObjectId(userId);
        const alreadyApplied = promo.vendorApplications?.some(
            (a) => String(a.vendorId) === userId,
        );
        if (alreadyApplied) throw new AppError('You have already applied to this promo.', 409);

        await Promo.findByIdAndUpdate(promoId, {
            $push: {
                vendorApplications: {
                    vendorId: vendorObjectId,
                    applicationStatus: 'pending',
                    appliedAt: new Date(),
                },
            },
        });

        logger.info({ promoId, userId }, '[Promos] Vendor applied to platform promo');

        return ResponseHandler.success(c, 'Application submitted. An admin will review your application shortly.');
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, '[Promos] Failed to apply to platform promo');
        throw new AppError('Failed to submit promo application.', 500);
    }
};
