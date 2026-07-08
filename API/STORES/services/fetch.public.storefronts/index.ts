import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { VendorStore } from '../../models/index.js';
import { LivestreamSession } from '../../../LIVESTREAMS/models/index.js';
import { fetchPublicStorefrontsQuerySchema } from '../../schemas/index.js';
import { serializeProducts } from '../../../PRODUCTS/utils/index.js';
import type { PublicStorefront } from '../../interfaces/index.js';

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
) =>
  serializeProducts(products).map((product) => ({
    _id: String(product._id),
    name: product.name,
    category: product.category,
    pricing: product.pricing,
    media: product.media,
    shortDescription: product.shortDescription,
    inventory: product.inventory,
  }));

export const fetchPublicStorefrontsController = async (context: Context) => {
  try {
    const parsed = fetchPublicStorefrontsQuerySchema.safeParse(context.req.query());
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    const { page, limit, productsPerStore } = parsed.data;
    const skip = (page - 1) * limit;

    const [stores, storeTotal] = await Promise.all([
      VendorStore.find({ status: 'active' })
        .select('_id vendorId name slug description logoUrl updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorStore.countDocuments({ status: 'active' }),
    ]);

    const storeIds = stores.map((store) => store._id);
    const vendorIds = [...new Set(stores.map((store) => String(store.vendorId)))];

    const [storeProducts, productCounts, vendors] = await Promise.all([
      storeIds.length > 0
        ? Product.find({ status: 'active', storeId: { $in: storeIds } })
            .select('_id name category pricing media shortDescription storeId vendorId inventory')
            .sort({ updatedAt: -1 })
            .lean()
        : Promise.resolve([]),
      storeIds.length > 0
        ? Product.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
            { $match: { status: 'active', storeId: { $in: storeIds } } },
            { $group: { _id: '$storeId', count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      vendorIds.length > 0
        ? User.find({ _id: { $in: vendorIds } }).select('_id name').lean()
        : Promise.resolve([]),
    ]);

    const productCountMap = new Map(
      productCounts.map((row) => [String(row._id), row.count]),
    );

    const activeLivestreams = storeIds.length > 0
      ? await LivestreamSession.find({
          storeId: { $in: storeIds },
          status: 'active',
        })
          .select('_id title storeId')
          .lean()
      : [];
    const livestreamByStore = new Map(
      activeLivestreams.map((stream) => [String(stream.storeId), stream]),
    );

    const vendorMap = new Map(vendors.map((vendor) => [String(vendor._id), vendor.name ?? 'Vendor']));
    const productsByStore = new Map<string, typeof storeProducts>();

    storeProducts.forEach((product) => {
      const key = String(product.storeId);
      const bucket = productsByStore.get(key) ?? [];
      if (bucket.length < productsPerStore) {
        bucket.push(product);
        productsByStore.set(key, bucket);
      }
    });

    const storefronts: PublicStorefront[] = stores.map((store) => {
      const storeKey = String(store._id);
      const products = mapStorefrontProducts(productsByStore.get(storeKey) ?? []);
      return {
        id: storeKey,
        name: store.name,
        slug: store.slug,
        description: store.description,
        logoUrl: store.logoUrl ?? null,
        vendorId: String(store.vendorId),
        vendorName: vendorMap.get(String(store.vendorId)) ?? 'Vendor',
        productCount: productCountMap.get(storeKey) ?? products.length,
        products,
        activeLivestream: livestreamByStore.has(storeKey)
          ? {
              id: String(livestreamByStore.get(storeKey)!._id),
              title: livestreamByStore.get(storeKey)!.title,
            }
          : null,
      };
    });

    if (page === 1) {
      const orphanProducts = await Product.find({
        status: 'active',
        $or: [{ storeId: { $exists: false } }, { storeId: null }],
      })
        .select('_id name pricing media shortDescription vendorId')
        .sort({ updatedAt: -1 })
        .limit(limit * productsPerStore)
        .lean();

      const orphanVendorIds = [...new Set(orphanProducts.map((product) => String(product.vendorId)))];
      const orphanVendors = orphanVendorIds.length
        ? await User.find({ _id: { $in: orphanVendorIds } }).select('_id name').lean()
        : [];
      const orphanVendorMap = new Map(
        orphanVendors.map((vendor) => [String(vendor._id), vendor.name ?? 'Vendor']),
      );

      const orphansByVendor = new Map<string, typeof orphanProducts>();
      orphanProducts.forEach((product) => {
        const vendorKey = String(product.vendorId);
        const bucket = orphansByVendor.get(vendorKey) ?? [];
        if (bucket.length < productsPerStore) {
          bucket.push(product);
          orphansByVendor.set(vendorKey, bucket);
        }
      });

      orphansByVendor.forEach((products, vendorId) => {
        const existing = storefronts.some((entry) => entry.vendorId === vendorId);
        if (existing || products.length === 0) return;
        const vendorName = orphanVendorMap.get(vendorId) ?? 'Vendor';
        storefronts.push({
          id: `vendor-${vendorId}`,
          name: `${vendorName} Store`,
          slug: `vendor-${vendorId}`,
          vendorId,
          vendorName,
          productCount: products.length,
          products: mapStorefrontProducts(products),
        });
      });
    }

    logger.info({ page, limit, count: storefronts.length }, 'Public storefronts fetched');

    return ResponseHandler.success(
      context,
      'Storefronts fetched successfully.',
      { storefronts },
      {
        page,
        limit,
        total: storeTotal + storefronts.filter((entry) => entry.id.startsWith('vendor-')).length,
        totalPages: Math.ceil(storeTotal / limit) || 1,
      },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch public storefronts');
    throw new AppError('Failed to fetch storefronts.', 500);
  }
};
