import type { Context } from 'hono';
import mongoose from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { Order } from '../../models/index.js';
import { mapOrderWinnerRow } from '../../utils/payLater.js';

export const fetchMyAuctionWinsController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const buyerId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const query = z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      livestreamId: z.string().optional(),
    })
    .parse(context.req.query());

  const skip = (query.page - 1) * query.limit;
  const filter: Record<string, unknown> = {
    buyerId: mongoose.Types.ObjectId.isValid(buyerId)
      ? new mongoose.Types.ObjectId(buyerId)
      : buyerId,
    source: 'livestream_auction',
  };

  if (query.livestreamId && mongoose.Types.ObjectId.isValid(query.livestreamId)) {
    filter.livestreamId = new mongoose.Types.ObjectId(query.livestreamId);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  const vendorIds = [...new Set(orders.map((order) => String(order.vendorId)))];
  const vendors = vendorIds.length
    ? await User.find({ _id: { $in: vendorIds } }).select('_id name').lean()
    : [];
  const vendorMap = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));

  const wins = orders.map((order) => ({
    ...mapOrderWinnerRow(order as never),
    productId: String(order.productId),
    vendorName: vendorMap.get(String(order.vendorId))?.name ?? 'Vendor',
    livestreamId: order.livestreamId ? String(order.livestreamId) : null,
    auctionId: order.auctionId ? String(order.auctionId) : null,
  }));

  logger.info({ buyerId, total }, 'Buyer auction wins fetched');

  return ResponseHandler.success(
    context,
    'Auction wins fetched.',
    { wins },
    {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  );
};
