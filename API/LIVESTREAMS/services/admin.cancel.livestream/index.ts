import type { Context } from 'hono';
import { z } from 'zod';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { publishLivestreamEvent } from '../../../../CORE/services/realtime/index.js';
import { LivestreamRecordingService } from '../../../../CORE/services/livestreams/recording/index.js';
import { LivestreamSession } from '../../models/index.js';

const AdminCancelSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

export const adminCancelLivestreamController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const actorRole = String(sessionUser.role ?? '').toLowerCase();
  if (actorRole !== 'admin' && actorRole !== 'super_admin') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const livestreamId = context.req.param('livestreamId');
  const payload = AdminCancelSchema.parse(await context.req.json().catch(() => ({})));

  const existing = await LivestreamSession.findOne({ _id: livestreamId, status: 'active' }).lean();

  if (!existing) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  const update: Record<string, unknown> = {
    status: 'cancelled',
    endedAt: new Date(),
    'metadata.adminCancelledBy': String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId),
    'metadata.adminCancelReason': payload.reason ?? 'Cancelled by admin',
  };

  if (existing.recordingEnabled) {
    const recordingUrl = await LivestreamRecordingService.stopAndResolveUrl(existing);
    if (recordingUrl) {
      update.recordingUrl = recordingUrl;
    }
  }

  await LivestreamSession.findByIdAndUpdate(livestreamId, { $set: update });

  const endedAt = new Date().toISOString();
  await publishLivestreamEvent(livestreamId, {
    type: 'livestream.cancelled',
    livestreamId,
    endedAt,
    cancelledBy: 'admin',
  });

  logger.info({ livestreamId, actorRole }, 'Livestream cancelled by admin');

  return ResponseHandler.success(context, 'Livestream cancelled by admin.', {
    livestreamId,
    status: 'cancelled',
    endedAt,
  });
};
