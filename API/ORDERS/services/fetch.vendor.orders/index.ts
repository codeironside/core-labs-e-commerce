import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { Order, type OrderStatus } from '../../models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { User } from '../../../AUTH/models/index.js';
import {
  buildScopedProductFilter,
  resolveVendorCatalogScope,
} from '../../../STORES/utils/vendorAnalyticsScope.js';

const ORDER_STATUS_VALUES: OrderStatus[] = ['pending_payment', 'paid', 'payment_failed', 'cancelled'];

export const fetchVendorOrdersController = async (context: Context) => {
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

    const page = Math.max(Number(context.req.query('page') ?? 1), 1);
    const limit = Math.min(Math.max(Number(context.req.query('limit') ?? 20), 1), 100);
    const skip = (page - 1) * limit;
    const statusFilter = context.req.query('status');

    const orderFilter: Record<string, unknown> = {};
    if (scope.mode === 'owner') {
      orderFilter.vendorId = mongoose.isValidObjectId(scope.vendorId)
        ? new mongoose.Types.ObjectId(scope.vendorId)
        : scope.vendorId;
    } else {
      const scopedProducts = await Product.find(buildScopedProductFilter(scope))
        .select('_id')
        .lean();
      const productIds = scopedProducts.map((row) => row._id);
      orderFilter.productId = { $in: productIds };
    }

    if (statusFilter && ORDER_STATUS_VALUES.includes(statusFilter as OrderStatus)) {
      orderFilter.status = statusFilter;
    }

    const [orders, total] = await Promise.all([
      Order.find(orderFilter)
        .select('buyerId productId source status paymentStatus paymentMethod quantity breakdown createdAt payLaterStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(orderFilter),
    ]);

    const productIds = [...new Set(orders.map((order) => String(order.productId)))];
    const buyerIds = [...new Set(orders.map((order) => String(order.buyerId)))];

    const [products, buyers] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select('_id name media').lean(),
      User.find({ _id: { $in: buyerIds } }).select('_id name email').lean(),
    ]);

    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const buyerMap = new Map(buyers.map((buyer) => [String(buyer._id), buyer]));

    return ResponseHandler.success(
      context,
      'Vendor orders loaded.',
      {
        orders: orders.map((order) => {
          const product = productMap.get(String(order.productId));
          const buyer = buyerMap.get(String(order.buyerId));
          return {
            _id: String(order._id),
            productId: String(order.productId),
            productName: product?.name ?? 'Product',
            productImage: product?.media?.[0]?.thumbnailUrl ?? product?.media?.[0]?.url ?? null,
            buyerId: String(order.buyerId),
            buyerName: buyer?.name ?? 'Buyer',
            source: order.source,
            status: order.status,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            payLaterStatus: order.payLaterStatus ?? null,
            quantity: order.quantity,
            totalAmount: order.breakdown?.totalAmount ?? 0,
            currency: order.breakdown?.currency ?? 'NGN',
            createdAt: order.createdAt,
          };
        }),
      },
      { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch vendor orders');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
  }
};
