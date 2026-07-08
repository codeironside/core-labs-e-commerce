import type { Context } from 'hono';
import mongoose from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { LivestreamSession } from '../../models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { User } from '../../../AUTH/models/index.js';
import { broadcastLivestreamProducts, fetchLivestreamProductSnapshot } from '../../utils/livestreamProducts.js';

const UpdateListedProductsSchema = z.object({
  listedProductIds: z.array(z.string().length(24)),
});

export const updateListedProductsController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const livestreamId = context.req.param('livestreamId');
  const body = UpdateListedProductsSchema.parse(await context.req.json().catch(() => ({})));

  const vendor = await User.findById(vendorId).select('userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const ownedProducts = await Product.find({
    vendorId,
    _id: { $in: body.listedProductIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select('_id')
    .lean();

  if (ownedProducts.length !== body.listedProductIds.length) {
    throw new AppError('One or more selected products are invalid.', 400);
  }

  const livestream = await LivestreamSession.findOneAndUpdate(
    { _id: livestreamId, vendorId, status: 'active' },
    { $set: { listedProductIds: ownedProducts.map((product) => product._id) } },
    { new: true },
  ).lean();

  if (!livestream) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  await broadcastLivestreamProducts(livestreamId);

  const snapshot = await fetchLivestreamProductSnapshot(livestreamId);

  logger.info({ livestreamId, vendorId, productCount: snapshot.products.length }, 'Livestream products updated');

  return ResponseHandler.success(context, 'Listed products updated.', {
    products: snapshot.products,
    openAuctionProductIds: snapshot.openAuctionProductIds,
  });
};
