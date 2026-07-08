import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { LivestreamSession } from '../../../LIVESTREAMS/models/index.js';
import { Order } from '../../../ORDERS/models/index.js';
import { VendorStore } from '../../models/index.js';
import { serializeProducts } from '../../../PRODUCTS/utils/index.js';
import type { PublicStorefront } from '../../interfaces/index.js';

const ORPHAN_SLUG_PREFIX = 'vendor-';
const PAID_ORDER_STATUSES = ['paid'] as const;

const resolveSoldCounts = async (
  productIds: mongoose.Types.ObjectId[],
): Promise<Map<string, number>> => {
  if (productIds.length === 0) return new Map();
  const soldCounts = await Order.aggregate<{ _id: mongoose.Types.ObjectId; soldCount: number }>([
    { $match: { productId: { $in: productIds }, status: { $in: PAID_ORDER_STATUSES } } },
    { $group: { _id: '$productId', soldCount: { $sum: '$quantity' } } },
  ]);
  return new Map(soldCounts.map((row) => [String(row._id), row.soldCount]));
};

const sortBySoldCount = <T extends { _id: unknown }>(
  products: T[],
  soldCountMap: Map<string, number>,
): T[] =>
  [...products].sort(
    (a, b) => (soldCountMap.get(String(b._id)) ?? 0) - (soldCountMap.get(String(a._id)) ?? 0),
  );

const mapStorefrontProducts = (
  products: Array<{
    _id: unknown;
    name: string;
    category?: string;
    pricing?: { amount?: number; currency?: string; compareAtAmount?: number };
    media?: Array<{ url?: string; thumbnailUrl?: string }>;
    shortDescription?: string;
    inventory?: { quantity?: number };
  }>,
  soldCountMap?: Map<string, number>,
) =>
  serializeProducts(products).map((product) => ({
    _id: String(product._id),
    name: product.name,
    category: product.category,
    pricing: product.pricing,
    media: product.media,
    shortDescription: product.shortDescription,
    inventory: product.inventory,
    soldCount: soldCountMap?.get(String(product._id)) ?? 0,
  }));

export const fetchPublicStoreController = async (context: Context) => {
  try {
    const slug = context.req.param('slug')?.trim();
    if (!slug) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED, 400);
    }

    if (slug.startsWith(ORPHAN_SLUG_PREFIX)) {
      const vendorId = slug.slice(ORPHAN_SLUG_PREFIX.length);
      if (!mongoose.isValidObjectId(vendorId)) {
        throw new AppError('Store not found.', 404);
      }

      const [vendor, products, productCount, activeLivestream] = await Promise.all([
        User.findById(vendorId).select('name').lean(),
        Product.find({
          vendorId,
          status: 'active',
          $or: [{ storeId: { $exists: false } }, { storeId: null }],
        })
          .select('_id name category pricing media shortDescription inventory vendorId')
          .sort({ updatedAt: -1 })
          .lean(),
        Product.countDocuments({
          vendorId,
          status: 'active',
          $or: [{ storeId: { $exists: false } }, { storeId: null }],
        }),
        LivestreamSession.findOne({ vendorId, status: 'active' })
          .select('_id title')
          .lean(),
      ]);

      if (!vendor || products.length === 0) {
        throw new AppError('Store not found.', 404);
      }

      const orphanSoldCounts = await resolveSoldCounts(products.map((product) => product._id));
      const orphanProductsSorted = sortBySoldCount(products, orphanSoldCounts);

      const storefront: PublicStorefront & {
        activeLivestream: { id: string; title: string } | null;
        isSynthetic: boolean;
      } = {
        id: `vendor-${vendorId}`,
        name: `${vendor.name ?? 'Vendor'} Store`,
        slug,
        vendorId,
        vendorName: vendor.name ?? 'Vendor',
        productCount,
        products: mapStorefrontProducts(orphanProductsSorted, orphanSoldCounts),
        activeLivestream: activeLivestream
          ? { id: String(activeLivestream._id), title: activeLivestream.title }
          : null,
        isSynthetic: true,
      };

      return ResponseHandler.success(context, 'Storefront fetched successfully.', { storefront });
    }

    const store = await VendorStore.findOne({ slug, status: 'active' })
      .select('_id vendorId name slug description logoUrl coverImageUrl address location googlePlaceId')
      .lean();

    if (!store) {
      throw new AppError('Store not found.', 404);
    }

    const [vendor, products, productCount, activeLivestream] = await Promise.all([
      User.findById(store.vendorId).select('name').lean(),
      Product.find({ storeId: store._id, status: 'active' })
        .select('_id name category pricing media shortDescription inventory storeId vendorId')
        .sort({ updatedAt: -1 })
        .lean(),
      Product.countDocuments({ storeId: store._id, status: 'active' }),
      LivestreamSession.findOne({ storeId: store._id, status: 'active' })
        .select('_id title')
        .lean(),
    ]);

    const soldCountMap = await resolveSoldCounts(products.map((product) => product._id));
    const productsSorted = sortBySoldCount(products, soldCountMap);

    const storefront: PublicStorefront & {
      activeLivestream: { id: string; title: string } | null;
      isSynthetic: boolean;
    } = {
      id: String(store._id),
      name: store.name,
      slug: store.slug,
      description: store.description,
      logoUrl: store.logoUrl ?? null,
      coverImageUrl: store.coverImageUrl ?? null,
      address: store.address ?? null,
      location:
        store.location?.lat != null && store.location?.lng != null
          ? { lat: store.location.lat, lng: store.location.lng }
          : null,
      vendorId: String(store.vendorId),
      vendorName: vendor?.name ?? 'Vendor',
      productCount,
      products: mapStorefrontProducts(productsSorted, soldCountMap),
      activeLivestream: activeLivestream
        ? { id: String(activeLivestream._id), title: activeLivestream.title }
        : null,
      isSynthetic: false,
    };

    logger.info({ slug, productCount }, 'Public store fetched');

    return ResponseHandler.success(context, 'Storefront fetched successfully.', { storefront });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch public store');
    throw new AppError('Failed to fetch storefront.', 500);
  }
};
