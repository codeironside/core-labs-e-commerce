import type { Context } from 'hono';
import { z } from 'zod';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { config } from '../../../../CORE/config/index.js';
import { LivestreamAuction, LivestreamSession } from '../../../LIVESTREAMS/models/index.js';
import { Order } from '../../models/index.js';
import {
  assertProductHasStock,
  decrementInventoryForPaidOrder,
  releaseInventoryAfterFailedPayment,
} from '../../../PRODUCTS/utils/inventory.js';

const payOrderSchema = z.object({
  paymentMethod: z.enum(['paystack_checkout', 'saved_card']).default('paystack_checkout'),
  savedCardAuthCode: z.string().optional(),
});

const assertLivestreamBuyNowPayable = async (
  order: InstanceType<typeof Order>,
  buyerId: string,
): Promise<void> => {
  if (String(order.buyerId) !== buyerId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.ORDER_PAYMENT_FORBIDDEN, 403);
  }

  if (!order.livestreamId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  const livestream = await LivestreamSession.findById(order.livestreamId)
    .select('status endedAt')
    .lean();

  const ended =
    !livestream
    || livestream.status === 'ended'
    || livestream.status === 'cancelled'
    || Boolean(livestream.endedAt);

  if (ended) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_PURCHASE_CLOSED, 409);
  }

  const openAuction = await LivestreamAuction.findOne({
    livestreamId: order.livestreamId,
    productId: order.productId,
    status: 'open',
    endsAt: { $gt: new Date() },
  })
    .select('_id')
    .lean();

  if (openAuction) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_IN_LIVE_AUCTION, 409);
  }
};

const assertAuctionWinnerPayable = async (
  order: InstanceType<typeof Order>,
  buyerId: string,
): Promise<void> => {
  if (String(order.buyerId) !== buyerId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.ORDER_PAYMENT_FORBIDDEN, 403);
  }

  if (!order.auctionId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.AUCTION_NOT_FOUND, 404);
  }

  const auction = await LivestreamAuction.findById(order.auctionId)
    .select('status highestBidderId')
    .lean();

  if (!auction || auction.status !== 'closed') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.AUCTION_NOT_OPEN, 409);
  }

  if (!auction.highestBidderId || String(auction.highestBidderId) !== buyerId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.ORDER_PAYMENT_FORBIDDEN, 403);
  }

  if (
    order.paymentTiming === 'pay_later'
    && order.payLaterExpiresAt
    && order.payLaterExpiresAt.getTime() <= Date.now()
  ) {
    order.payLaterStatus = 'expired';
    await order.save();
    throw new AppError('This pay-later window has expired.', 409);
  }
};

export const payOrderController = async (c: Context) => {
  try {
    const sessionUser = c.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const buyerId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const orderId = c.req.param('orderId');
    if (!orderId) throw new AppError(SYSTEM_MESSAGES.ERRORS.ORDER_NOT_FOUND, 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = payOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED, 400);
    }

    const order = await Order.findOne({ _id: orderId, buyerId });
    if (!order) throw new AppError(SYSTEM_MESSAGES.ERRORS.ORDER_NOT_FOUND, 404);

    if (order.status === 'paid' && order.paymentStatus === 'paid') {
      return ResponseHandler.success(c, 'Order already paid.', { order });
    }

    if (!['pending_payment', 'awaiting_settlement'].includes(order.status)) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.ORDER_INVALID_STATE, 409);
    }

    if (order.source === 'livestream_buy_now') {
      await assertLivestreamBuyNowPayable(order, buyerId);
    }

    if (order.source === 'livestream_auction') {
      await assertAuctionWinnerPayable(order, buyerId);
    }

    const productId = String(order.productId);
    const orderQuantity = order.quantity;

    await assertProductHasStock(productId, orderQuantity);

    try {
      await decrementInventoryForPaidOrder(productId, orderQuantity);
    } catch (inventoryError) {
      if (inventoryError instanceof AppError) throw inventoryError;
      throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_OUT_OF_STOCK, 409);
    }

    const authHeader = c.req.header('authorization');
    if (!authHeader) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const financeResponse = await fetch(`${config.app.financeUrl}/api/v1/orders/${orderId}/pay`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentMethod: parsed.data.paymentMethod,
        ...(parsed.data.savedCardAuthCode ? { savedCardAuthCode: parsed.data.savedCardAuthCode } : {}),
      }),
    });

    const financePayload = await financeResponse.json().catch(() => ({})) as {
      success?: boolean;
      message?: string;
      data?: { order?: InstanceType<typeof Order> };
    };

    if (!financeResponse.ok || !financePayload.success) {
      await releaseInventoryAfterFailedPayment(productId, orderQuantity);
      throw new AppError(financePayload.message ?? 'Payment failed.', financeResponse.status || 400);
    }

    logger.info({ orderId, buyerId, source: order.source }, 'Order payment initiated via finance');

    return ResponseHandler.success(c, financePayload.message ?? 'Order payment initiated.', financePayload.data ?? {});
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to pay order');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
  }
};
