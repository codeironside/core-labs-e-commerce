import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { Product } from '../../models/index.js';
import { Order } from '../../../ORDERS/models/index.js';
import { LivestreamAuction } from '../../../LIVESTREAMS/models/index.js';
import {
  buildScopedProductFilter,
  resolveVendorCatalogScope,
} from '../../../STORES/utils/vendorAnalyticsScope.js';

const PAID_STATUSES = ['paid'] as const;

export const fetchVendorHubStatsController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
    }

    const userId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const scope = (await resolveVendorCatalogScope(userId)) ?? { mode: 'owner' as const, vendorId: userId };

    const productFilter = buildScopedProductFilter(scope);
    const activeProductFilter = { ...productFilter, status: 'active' };

    const scopedProductIds =
      scope.mode === 'manager'
        ? (await Product.find(productFilter).select('_id').lean()).map((row) => row._id)
        : [];

    const salesMatch: Record<string, unknown> = { status: { $in: PAID_STATUSES } };
    const auctionMatch: Record<string, unknown> = {};
    const orderCountMatch: Record<string, unknown> = {};

    if (scope.mode === 'owner') {
      const vendorObjectId = mongoose.isValidObjectId(scope.vendorId)
        ? new mongoose.Types.ObjectId(scope.vendorId)
        : scope.vendorId;
      salesMatch.vendorId = vendorObjectId;
      auctionMatch.vendorId = vendorObjectId;
      orderCountMatch.vendorId = vendorObjectId;
    } else {
      salesMatch.productId = { $in: scopedProductIds };
      auctionMatch.productId = { $in: scopedProductIds };
      orderCountMatch.productId = { $in: scopedProductIds };
    }

    const [activeListings, totalAuctions, totalOrders, salesAgg] = await Promise.all([
      Product.countDocuments(activeProductFilter),
      LivestreamAuction.countDocuments(auctionMatch),
      Order.countDocuments(orderCountMatch),
      Order.aggregate<{ _id: null; totalRevenue: number; totalUnitsSold: number }>([
        { $match: salesMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$breakdown.totalAmount' },
            totalUnitsSold: { $sum: '$quantity' },
          },
        },
      ]),
    ]);

    const revenue = salesAgg[0]?.totalRevenue ?? 0;
    const unitsSold = salesAgg[0]?.totalUnitsSold ?? 0;

    return ResponseHandler.success(context, 'Vendor hub stats loaded.', {
      totalSalesRevenue: revenue,
      totalUnitsSold: unitsSold,
      activeListings,
      totalAuctions,
      totalOrders,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch vendor hub stats');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
  }
};
