import type { Context } from 'hono';
import mongoose from 'mongoose';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { LivestreamSession, LivestreamAuction, LivestreamComment } from '../../../LIVESTREAMS/models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { Order } from '../../../ORDERS/models/index.js';

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, required: true },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    workspaceId: { type: mongoose.Schema.Types.ObjectId },
    reference: { type: String },
  },
  { timestamps: true, strict: false },
);

const escrowSchema = new mongoose.Schema(
  {
    orderCode: { type: Number },
    buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String },
    amountUsdc: { type: Number },
    logisticsFeeUsdc: { type: Number },
  },
  { timestamps: true, strict: false },
);

const PaymentRecord =
  mongoose.models.AdminPaymentRecord ??
  mongoose.model('AdminPaymentRecord', paymentSchema, 'payments');

const EscrowRecord =
  mongoose.models.AdminEscrowRecord ??
  mongoose.model('AdminEscrowRecord', escrowSchema, 'escrowwalletorders');

export const fetchCommerceAnalyticsController = async (context: Context) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    livestreamTotal,
    activeLivestreams,
    productTotal,
    auctionTotal,
    openAuctions,
    orderTotal,
    paidOrders,
    gmvAgg,
    ordersLast7Days,
    commentTotal,
    paymentTotal,
    completedPayments,
    paymentVolumeAgg,
    escrowTotal,
    activeEscrows,
    disputedEscrows,
  ] = await Promise.all([
    LivestreamSession.countDocuments({}),
    LivestreamSession.countDocuments({ status: { $in: ['live', 'active', 'scheduled'] } }),
    Product.countDocuments({}),
    LivestreamAuction.countDocuments({}),
    LivestreamAuction.countDocuments({ status: 'open' }),
    Order.countDocuments({}),
    Order.countDocuments({ paymentStatus: 'paid' }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$breakdown.totalAmount' } } },
    ]),
    Order.countDocuments({ createdAt: { $gte: weekAgo } }),
    LivestreamComment.countDocuments({}),
    PaymentRecord.countDocuments({}),
    PaymentRecord.countDocuments({ status: 'completed' }),
    PaymentRecord.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    EscrowRecord.countDocuments({}),
    EscrowRecord.countDocuments({ status: { $in: ['initialized', 'shipped', 'delivered', 'pending_offramp'] } }),
    EscrowRecord.countDocuments({ status: 'disputed' }),
  ]);

  return ResponseHandler.success(context, 'Commerce platform analytics', {
    livestreams: { total: livestreamTotal, active: activeLivestreams },
    products: { total: productTotal },
    auctions: { total: auctionTotal, open: openAuctions },
    orders: {
      total: orderTotal,
      paid: paidOrders,
      last7Days: ordersLast7Days,
      gmv: (gmvAgg[0]?.total as number | undefined) ?? 0,
    },
    livestreamComments: { total: commentTotal },
    finance: {
      payments: {
        total: paymentTotal,
        completed: completedPayments,
        volumeByCurrency: paymentVolumeAgg.map((row) => ({
          currency: String(row._id),
          total: row.total as number,
          count: row.count as number,
        })),
      },
      escrow: {
        total: escrowTotal,
        active: activeEscrows,
        disputed: disputedEscrows,
      },
    },
  });
};
