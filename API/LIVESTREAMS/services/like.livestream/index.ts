import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import type { IdentitySessionUser } from '../../../../CORE/middlewares/auth/index.js';
import { broadcastLivestreamEvent } from '../../../../CORE/services/livestreamBroadcast/index.js';
import { LivestreamLike, LivestreamSession } from '../../models/index.js';
import { resolveGuestViewerKey } from '../../utils/viewerStream.js';

export const likeLivestreamController = async (context: Context) => {
  try {
    const livestreamId = context.req.param('livestreamId');
    if (!livestreamId) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
    }

    const livestream = await LivestreamSession.findById(livestreamId)
      .select('_id status endedAt likeCount')
      .lean();
    if (!livestream) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
    }

    const ended =
      livestream.status === 'ended' ||
      livestream.status === 'cancelled' ||
      Boolean(livestream.endedAt);
    if (ended) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_ENDED, 410);
    }

    const sessionUser = context.get('user') as IdentitySessionUser | undefined;
    const viewerKey = sessionUser?.userId
      ? String(sessionUser.userId)
      : resolveGuestViewerKey(context);

    await LivestreamLike.create({
      livestreamId,
      viewerKey,
      isGuest: !sessionUser?.userId,
    });

    const updated = await LivestreamSession.findByIdAndUpdate(
      livestreamId,
      { $inc: { likeCount: 1 } },
      { new: true },
    )
      .select('likeCount')
      .lean();

    const likeCount = updated?.likeCount ?? (livestream.likeCount ?? 0) + 1;

    await broadcastLivestreamEvent(livestreamId, {
      type: 'like.created',
      livestreamId,
      likeCount,
      viewerKey,
      createdAt: new Date().toISOString(),
    });

    logger.info({ livestreamId, viewerKey, likeCount }, 'Livestream liked');

    return ResponseHandler.success(context, 'Livestream liked.', { likeCount });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to like livestream');
    throw new AppError('Could not like livestream.', 500);
  }
};
