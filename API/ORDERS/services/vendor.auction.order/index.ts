import type { Context } from 'hono';
import { z } from 'zod';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { Order } from '../../models/index.js';
import { mapOrderWinnerRow } from '../../utils/payLater.js';

const GrantPayLaterSchema = z.object({
  hours: z.number().int().min(1).max(168),
});

export const grantPayLaterController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const orderIdParam = context.req.param('orderId');
  if (!orderIdParam) {
    throw new AppError('Pending auction order not found.', 404);
  }
  const orderId = orderIdParam;
  const body = GrantPayLaterSchema.parse(await context.req.json().catch(() => ({})));

  const vendor = await User.findById(vendorId).select('userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const order = await Order.findOne({
    _id: orderId,
    vendorId,
    source: 'livestream_auction',
    paymentStatus: 'pending',
  });

  if (!order) {
    throw new AppError('Pending auction order not found.', 404);
  }

  const payLaterExpiresAt = new Date(Date.now() + body.hours * 60 * 60 * 1000);
  order.paymentTiming = 'pay_later';
  order.payLaterExpiresAt = payLaterExpiresAt;
  order.payLaterStatus = 'active';
  await order.save();

  return ResponseHandler.success(context, 'Pay later window granted.', {
    order: mapOrderWinnerRow(order),
  });
};

const WinnerMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const sendWinnerMessageController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const orderIdParam = context.req.param('orderId');
  if (!orderIdParam) {
    throw new AppError('Auction order not found.', 404);
  }
  const orderId = orderIdParam;
  const body = WinnerMessageSchema.parse(await context.req.json().catch(() => ({})));

  const vendor = await User.findById(vendorId).select('userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, vendorId, source: 'livestream_auction' },
    { $set: { vendorWinnerMessage: body.message } },
    { new: true },
  ).lean();

  if (!order) {
    throw new AppError('Auction order not found.', 404);
  }

  return ResponseHandler.success(context, 'Message saved for winner.', {
    order: mapOrderWinnerRow(order),
  });
};
