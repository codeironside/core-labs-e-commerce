import type { Context } from 'hono';
import mongoose from 'mongoose';
import { z } from 'zod';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { publishLivestreamEvent } from '../../../../CORE/services/realtime/index.js';
import { LivestreamSession } from '../../models/index.js';
import { User } from '../../../AUTH/models/index.js';

const BanParticipantSchema = z.object({
  userId: z.string().length(24),
  reason: z.string().min(3).max(500).optional(),
});

export const banLivestreamParticipantController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const livestreamIdParam = context.req.param('livestreamId');
  if (!livestreamIdParam) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }
  const livestreamId = livestreamIdParam;
  const payload = BanParticipantSchema.parse(await context.req.json().catch(() => ({})));

  const vendor = await User.findById(vendorId).select('userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  if (payload.userId === vendorId) {
    throw new AppError('You cannot ban yourself from your stream.', 400);
  }

  const targetUserId = new mongoose.Types.ObjectId(payload.userId);
  const livestream = await LivestreamSession.findOneAndUpdate(
    { _id: livestreamId, vendorId, status: 'active' },
    { $addToSet: { bannedUserIds: targetUserId } },
    { new: true },
  ).lean();

  if (!livestream) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  await publishLivestreamEvent(livestreamId, {
    type: 'livestream.participant-banned',
    livestreamId,
    userId: payload.userId,
    reason: payload.reason ?? 'Removed by vendor',
  });

  logger.info({ livestreamId, vendorId, bannedUserId: payload.userId }, 'Participant banned from livestream');

  return ResponseHandler.success(context, 'User banned from this livestream.', {
    bannedUserId: payload.userId,
  });
};
