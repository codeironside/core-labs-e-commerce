import type { IOrderDocument } from '../models/index.js';

export const resolvePayLaterState = (order: Pick<
  IOrderDocument,
  'paymentStatus' | 'paymentTiming' | 'payLaterExpiresAt' | 'payLaterStatus'
>): PayLaterDisplayStatus => {
  if (order.paymentStatus === 'paid') {
    return 'paid';
  }

  if (order.paymentTiming !== 'pay_later') {
    return 'unpaid';
  }

  if (order.payLaterStatus === 'expired') {
    return 'expired';
  }

  if (order.payLaterExpiresAt && order.payLaterExpiresAt.getTime() <= Date.now()) {
    return 'expired';
  }

  return 'pay_later';
};

export type PayLaterDisplayStatus = 'paid' | 'unpaid' | 'pay_later' | 'expired';

export const mapOrderWinnerRow = (order: IOrderDocument & {
  buyer?: { name?: string; email?: string };
}) => ({
  orderId: String(order._id),
  buyerId: String(order.buyerId),
  buyerName: order.buyer?.name ?? 'Buyer',
  buyerEmail: order.buyer?.email ?? '',
  productName: typeof order.pricingSnapshot?.productName === 'string'
    ? order.pricingSnapshot.productName
    : 'Auction item',
  amount: order.breakdown.totalAmount,
  currency: order.breakdown.currency,
  paymentStatus: order.paymentStatus,
  paymentTiming: order.paymentTiming,
  payLaterExpiresAt: order.payLaterExpiresAt?.toISOString() ?? null,
  payLaterStatus: resolvePayLaterState(order),
  vendorWinnerMessage: order.vendorWinnerMessage ?? null,
  createdAt: order.createdAt.toISOString(),
});
