import type { Context } from 'hono';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { LivestreamSession, LivestreamAuction } from '../../../LIVESTREAMS/models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { Order } from '../../../ORDERS/models/index.js';

export const fetchAdminOverviewController = async (context: Context) => {
  const page = Math.max(1, Number(context.req.query('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(context.req.query('limit') ?? 20)));
  const skip = (page - 1) * limit;

  const [livestreams, livestreamTotal, products, productTotal, auctions, auctionTotal, orders, orderTotal] =
    await Promise.all([
      LivestreamSession.find({})
        .select('title status vendorId createdAt endedAt listedProductIds')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LivestreamSession.countDocuments({}),
      Product.find({})
        .select('name status vendorId pricing inventory createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments({}),
      LivestreamAuction.find({})
        .select('status startingBid highestBidAmount vendorId livestreamId productId endsAt createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LivestreamAuction.countDocuments({}),
      Order.find({})
        .select('buyerId vendorId productId status paymentStatus breakdown.totalAmount createdAt source')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({}),
    ]);

  return ResponseHandler.success(context, 'Admin commerce overview', {
    livestreams: { items: livestreams, total: livestreamTotal, page, limit },
    products: { items: products, total: productTotal, page, limit },
    auctions: { items: auctions, total: auctionTotal, page, limit },
    payments: { items: orders, total: orderTotal, page, limit },
  });
};
