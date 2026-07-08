import type { Context } from 'hono';
import mongoose from 'mongoose';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { ProductVersion } from '../../../PRODUCTS/models/productVersion.js';
import { Order } from '../../../ORDERS/models/index.js';
import {
  LivestreamSession,
  LivestreamAuction,
  LivestreamBid,
  LivestreamParticipant,
  LivestreamComment,
} from '../../../LIVESTREAMS/models/index.js';

const parseObjectId = (value: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError('Invalid identifier.', 400);
  }
  return new mongoose.Types.ObjectId(value);
};

export const fetchVendorDetailController = async (context: Context) => {
  const vendorId = parseObjectId(String(context.req.param('vendorId') ?? ''));

  const [products, salesAsVendor, purchasesAsBuyer, livestreamsHosted, auctionsHosted, bidsPlaced, commentsPosted] =
    await Promise.all([
      Product.find({ vendorId })
        .select('name status pricing inventory createdAt updatedAt version')
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ vendorId })
        .select('buyerId productId status paymentStatus breakdown.totalAmount breakdown.currency source createdAt pricingSnapshot')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Order.find({ buyerId: vendorId })
        .select('vendorId productId status paymentStatus breakdown.totalAmount breakdown.currency source createdAt pricingSnapshot')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      LivestreamSession.find({ vendorId })
        .select('title status createdAt endedAt listedProductIds')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      LivestreamAuction.find({ vendorId })
        .select('status startingBid highestBidAmount productId livestreamId endsAt createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      LivestreamBid.find({ bidderId: vendorId })
        .select('auctionId livestreamId amount createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      LivestreamComment.find({ userId: vendorId })
        .select('livestreamId message createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

  const productIds = products.map((product) => product._id);
  const versions = productIds.length
    ? await ProductVersion.find({ productId: { $in: productIds } })
        .select('productId versionNumber snapshot changedFields createdAt')
        .sort({ productId: 1, versionNumber: -1 })
        .lean()
    : [];

  const versionsByProduct = versions.reduce<Record<string, typeof versions>>((accumulator, version) => {
    const key = String(version.productId);
    const bucket = accumulator[key] ?? [];
    bucket.push(version);
    accumulator[key] = bucket;
    return accumulator;
  }, {});

  const participantSessions = livestreamsHosted.length
    ? await LivestreamParticipant.aggregate([
        { $match: { livestreamId: { $in: livestreamsHosted.map((session) => session._id) } } },
        { $group: { _id: '$livestreamId', participantCount: { $sum: 1 } } },
      ])
    : [];

  const participantMap = new Map(
    participantSessions.map((row) => [String(row._id), row.participantCount as number]),
  );

  const paidSales = salesAsVendor.filter((order) => order.paymentStatus === 'paid');
  const paidPurchases = purchasesAsBuyer.filter((order) => order.paymentStatus === 'paid');
  const totalSalesRevenue = paidSales.reduce((sum, order) => sum + (order.breakdown?.totalAmount ?? 0), 0);
  const totalPurchaseSpend = paidPurchases.reduce((sum, order) => sum + (order.breakdown?.totalAmount ?? 0), 0);

  return ResponseHandler.success(context, 'Vendor commerce detail', {
    vendorId: String(vendorId),
    summary: {
      productCount: products.length,
      salesCount: salesAsVendor.length,
      purchaseCount: purchasesAsBuyer.length,
      livestreamCount: livestreamsHosted.length,
      auctionCount: auctionsHosted.length,
      bidCount: bidsPlaced.length,
      totalSalesRevenue,
      totalPurchaseSpend,
    },
    products: products.map((product) => ({
      ...product,
      versions: versionsByProduct[String(product._id)] ?? [],
    })),
    salesAsVendor,
    purchasesAsBuyer,
    livestreamsHosted: livestreamsHosted.map((session) => ({
      ...session,
      participantCount: participantMap.get(String(session._id)) ?? 0,
    })),
    auctionsHosted,
    bidsPlaced,
    commentsPosted,
  });
};
