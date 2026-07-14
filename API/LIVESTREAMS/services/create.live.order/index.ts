import type { Context } from 'hono';
import mongoose from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { config } from '../../../../CORE/config/index.js';
import { LivestreamAuction, LivestreamSession } from '../../models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { assertProductHasStock } from '../../../PRODUCTS/utils/inventory.js';

const CreateLiveOrderSchema = z.object({
  productId: z.string().length(24),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const createLivestreamOrderController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const buyerId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const livestreamIdParam = context.req.param('livestreamId');
  if (!livestreamIdParam) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }
  const livestreamId = livestreamIdParam;
  const body = CreateLiveOrderSchema.parse(await context.req.json().catch(() => ({})));

  const livestream = await LivestreamSession.findOne({
    _id: livestreamId,
    status: 'active',
    endedAt: { $exists: false },
  })
    .select('_id vendorId listedProductIds status endedAt')
    .lean();

  if (!livestream) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_ENDED, 410);
  }

  const isListed = (livestream.listedProductIds ?? []).some(
    (id) => String(id) === body.productId,
  );
  if (!isListed) {
    throw new AppError('This product is not available on this livestream.', 400);
  }

  const openAuction = await LivestreamAuction.findOne({
    livestreamId,
    productId: new mongoose.Types.ObjectId(body.productId),
    status: 'open',
    endsAt: { $gt: new Date() },
  })
    .select('_id')
    .lean();

  if (openAuction) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_IN_LIVE_AUCTION, 409);
  }

  const product = await Product.findOne({
    _id: body.productId,
    vendorId: livestream.vendorId,
    status: 'active',
  })
    .select('_id inventory')
    .lean();

  if (!product) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
  }

  await assertProductHasStock(body.productId, body.quantity);

  const authHeader = context.req.header('authorization');
  if (!authHeader) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }

  const financeResponse = await fetch(`${config.app.financeUrl}/api/v1/orders/live`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId: body.productId,
      livestreamId,
      vendorId: String(livestream.vendorId),
      quantity: body.quantity,
    }),
  });

  const financePayload = await financeResponse.json().catch(() => ({})) as {
    success?: boolean;
    message?: string;
    data?: { order?: unknown };
  };

  if (!financeResponse.ok || !financePayload.success) {
    throw new AppError(financePayload.message ?? 'Failed to create order.', financeResponse.status || 500);
  }

  logger.info({ livestreamId, buyerId, productId: body.productId }, 'Livestream buy-now order created via finance');

  return ResponseHandler.success(
    context,
    SYSTEM_MESSAGES.SUCCESS.ORDER_CREATED,
    financePayload.data ?? {},
    undefined,
    201,
  );
};
