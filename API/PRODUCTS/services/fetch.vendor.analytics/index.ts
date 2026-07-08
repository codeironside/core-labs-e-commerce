import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { Product } from '../../models/index.js';
import { ProductVersion } from '../../models/productVersion.js';
import { Order } from '../../../ORDERS/models/index.js';
import { User } from '../../../AUTH/models/index.js';
import {
  assertProductAccessibleInScope,
  buildScopedProductFilter,
  resolveVendorCatalogScope,
} from '../../../STORES/utils/vendorAnalyticsScope.js';

const PAID_STATUSES = ['paid'] as const;

export const fetchVendorProductAnalyticsController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
    }

    const userId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const productId = context.req.param('productId');

    if (!productId || !mongoose.isValidObjectId(productId)) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
    }

    const scope = await resolveVendorCatalogScope(userId);
    if (!scope) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
    }

    const canAccess = await assertProductAccessibleInScope(scope, productId);
    if (!canAccess) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
    }

    const productFilter =
      scope.mode === 'owner'
        ? { _id: productId, ...(buildScopedProductFilter(scope) as Record<string, unknown>) }
        : { _id: productId, storeId: { $in: scope.storeIds.map((id) => new mongoose.Types.ObjectId(id)) } };

    const product = await Product.findOne(productFilter).lean();
    if (!product) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
    }

    const vendorId = scope.mode === 'owner' ? scope.vendorId : String(product.vendorId);

    const [orders, versions, buyers] = await Promise.all([
      Order.find({
        vendorId,
        productId,
        status: { $in: PAID_STATUSES },
      })
        .select('buyerId quantity breakdown pricingSnapshot createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      ProductVersion.find({ productId })
        .select('versionNumber snapshot changedFields createdAt')
        .sort({ versionNumber: -1 })
        .lean(),
      Order.aggregate<{
        _id: string;
        totalQuantity: number;
        totalSpent: number;
        lastPurchaseAt: Date;
        purchases: Array<{
          orderId: string;
          quantity: number;
          unitPrice: number;
          productVersion?: number;
          purchasedAt: Date;
        }>;
      }>([
        { $match: { vendorId: new mongoose.Types.ObjectId(vendorId), productId: new mongoose.Types.ObjectId(productId), status: { $in: PAID_STATUSES } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$buyerId',
            totalQuantity: { $sum: '$quantity' },
            totalSpent: { $sum: '$breakdown.totalAmount' },
            lastPurchaseAt: { $max: '$createdAt' },
            purchases: {
              $push: {
                orderId: { $toString: '$_id' },
                quantity: '$quantity',
                unitPrice: '$breakdown.discountedUnitPrice',
                productVersion: '$pricingSnapshot.productVersion',
                purchasedAt: '$createdAt',
              },
            },
          },
        },
      ]),
    ]);

    const buyerIds = buyers.map((entry) => entry._id);
    const buyerProfiles = await User.find({ _id: { $in: buyerIds } })
      .select('name email')
      .lean();
    const buyerMap = new Map(buyerProfiles.map((buyer) => [String(buyer._id), buyer]));

    const soldCount = orders.reduce((sum, order) => sum + order.quantity, 0);
    const revenue = orders.reduce((sum, order) => sum + (order.breakdown?.totalAmount ?? 0), 0);

    const salesByVersion = versions.map((version) => {
      const versionOrders = orders.filter(
        (order) => Number((order.pricingSnapshot as { productVersion?: number })?.productVersion ?? 0) === version.versionNumber,
      );
      return {
        versionNumber: version.versionNumber,
        snapshot: version.snapshot,
        changedFields: version.changedFields,
        createdAt: version.createdAt,
        unitsSold: versionOrders.reduce((sum, order) => sum + order.quantity, 0),
        revenue: versionOrders.reduce((sum, order) => sum + (order.breakdown?.totalAmount ?? 0), 0),
      };
    });

    return ResponseHandler.success(context, 'Product analytics loaded.', {
      product: {
        _id: String(product._id),
        name: product.name,
        status: product.status,
        currentVersion: product.version,
        pricing: product.pricing,
        inventory: product.inventory,
        auctionSettings: (product as { auctionSettings?: Record<string, unknown> }).auctionSettings ?? null,
      },
      summary: {
        soldCount,
        revenue,
        buyerCount: buyers.length,
        versionCount: versions.length,
      },
      versions: salesByVersion,
      buyers: buyers.map((entry) => {
        const profile = buyerMap.get(String(entry._id));
        return {
          buyerId: String(entry._id),
          name: profile?.name ?? 'Buyer',
          email: profile?.email ?? '',
          totalQuantity: entry.totalQuantity,
          totalSpent: entry.totalSpent,
          lastPurchaseAt: entry.lastPurchaseAt,
          purchases: entry.purchases,
        };
      }),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch vendor product analytics');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
  }
};

export const fetchVendorProductsOverviewController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
    }

    const userId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const scope = await resolveVendorCatalogScope(userId);
    if (!scope) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
    }

    const productFilter = buildScopedProductFilter(scope);
    const page = Number(context.req.query('page') ?? 1);
    const limit = Math.min(Number(context.req.query('limit') ?? 20), 100);
    const skip = (page - 1) * limit;

    const scopedProductIds =
      scope.mode === 'manager'
        ? (
            await Product.find({
              storeId: { $in: scope.storeIds.map((id) => new mongoose.Types.ObjectId(id)) },
            })
              .select('_id')
              .lean()
          ).map((row) => row._id)
        : [];

    const salesMatch: Record<string, unknown> = {
      status: { $in: PAID_STATUSES },
    };
    if (scope.mode === 'owner') {
      salesMatch.vendorId = mongoose.isValidObjectId(scope.vendorId)
        ? new mongoose.Types.ObjectId(scope.vendorId)
        : scope.vendorId;
    } else if (scopedProductIds.length > 0) {
      salesMatch.productId = { $in: scopedProductIds };
    } else {
      salesMatch.productId = { $in: [] };
    }

    const [products, total, salesAgg] = await Promise.all([
      Product.find(productFilter)
        .select('_id name status pricing media inventory version auctionSettings storeId createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(productFilter),
      Order.aggregate<{ _id: mongoose.Types.ObjectId; soldCount: number; revenue: number }>([
        { $match: salesMatch },
        {
          $group: {
            _id: '$productId',
            soldCount: { $sum: '$quantity' },
            revenue: { $sum: '$breakdown.totalAmount' },
          },
        },
      ]),
    ]);

    const salesMap = new Map(salesAgg.map((row) => [String(row._id), row]));

    return ResponseHandler.success(
      context,
      'Vendor products overview loaded.',
      {
        products: products.map((product) => {
          const sales = salesMap.get(String(product._id));
          return {
            _id: String(product._id),
            name: product.name,
            status: product.status,
            storeId: product.storeId ? String(product.storeId) : null,
            pricing: product.pricing,
            media: product.media,
            inventory: product.inventory,
            version: product.version,
            auctionSettings: (product as { auctionSettings?: Record<string, unknown> }).auctionSettings ?? null,
            soldCount: sales?.soldCount ?? 0,
            revenue: sales?.revenue ?? 0,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          };
        }),
      },
      { page, limit, total, totalPages: Math.ceil(total / limit) },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch vendor products overview');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
  }
};
