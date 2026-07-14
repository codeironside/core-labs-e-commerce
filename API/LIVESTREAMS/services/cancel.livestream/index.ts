import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { broadcastLivestreamEvent } from '../../../../CORE/services/livestreamBroadcast/index.js';
import { emitToLivestreamRoom } from '../../../../CORE/services/socket/index.js';
import { LivestreamRecordingService } from '../../../../CORE/services/livestreams/recording/index.js';
import { LivestreamSession } from '../../models/index.js';
import { User } from '../../../AUTH/models/index.js';

export const cancelLivestreamController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const livestreamIdParam = context.req.param('livestreamId');
  if (!livestreamIdParam) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }
  const livestreamId = livestreamIdParam;

  const vendor = await User.findById(vendorId).select('userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const existing = await LivestreamSession.findOne({
    _id: livestreamId,
    vendorId,
    status: 'active',
  }).lean();

  if (!existing) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  const update: Record<string, unknown> = {
    status: 'cancelled',
    endedAt: new Date(),
  };

  if (existing.recordingEnabled) {
    const recordingUrl = await LivestreamRecordingService.stopAndResolveUrl(existing);
    if (recordingUrl) {
      update.recordingUrl = recordingUrl;
    }
  }

  await LivestreamSession.findByIdAndUpdate(livestreamId, { $set: update });

  const endedAt = new Date().toISOString();

  await broadcastLivestreamEvent(livestreamId, {
    type: 'livestream.ended',
    livestreamId,
    status: 'cancelled',
    endedAt,
  });

  emitToLivestreamRoom(livestreamId, 'livestream:force-disconnect', {
    livestreamId,
    reason: 'cancelled',
  });

  logger.info({ vendorId, livestreamId }, 'Livestream cancelled by vendor');

  return ResponseHandler.success(context, 'Livestream cancelled.', {
    livestreamId,
    status: 'cancelled',
    endedAt,
  });
};
