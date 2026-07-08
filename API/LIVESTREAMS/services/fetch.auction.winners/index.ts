import type { Context } from 'hono';
import mongoose from 'mongoose';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { Order } from '../../../ORDERS/models/index.js';
import { mapOrderWinnerRow } from '../../../ORDERS/utils/payLater.js';
import { LivestreamSession } from '../../models/index.js';

export const fetchAuctionWinnersController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const livestreamId = context.req.param('livestreamId');

  const vendor = await User.findById(vendorId).select('userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const livestream = await LivestreamSession.findOne({ _id: livestreamId, vendorId })
    .select('_id title')
    .lean();
  if (!livestream) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  const orders = await Order.find({
    livestreamId: new mongoose.Types.ObjectId(livestreamId),
    source: 'livestream_auction',
  })
    .sort({ createdAt: -1 })
    .lean();

  const buyerIds = [...new Set(orders.map((order) => String(order.buyerId)))];
  const buyers = buyerIds.length
    ? await User.find({ _id: { $in: buyerIds } }).select('_id name email').lean()
    : [];
  const buyerMap = new Map(buyers.map((buyer) => [String(buyer._id), buyer]));

  const winners = orders.map((order) =>
    mapOrderWinnerRow({
      ...order,
      buyer: buyerMap.get(String(order.buyerId)),
    } as never),
  );

  const paid = winners.filter((winner) => winner.payLaterStatus === 'paid');
  const payLater = winners.filter((winner) => winner.payLaterStatus === 'pay_later');
  const unpaid = winners.filter((winner) => winner.payLaterStatus === 'unpaid');
  const expired = winners.filter((winner) => winner.payLaterStatus === 'expired');

  return ResponseHandler.success(context, 'Auction winners fetched.', {
    livestreamId,
    title: livestream.title,
    winners,
    summary: {
      total: winners.length,
      paid: paid.length,
      payLater: payLater.length,
      unpaid: unpaid.length,
      expired: expired.length,
    },
  });
};
