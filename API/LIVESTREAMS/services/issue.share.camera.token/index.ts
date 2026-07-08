import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import type { IdentitySessionUser } from '../../../../CORE/middlewares/auth/index.js';
import { LivestreamProviderService } from '../../../../CORE/services/livestreams/provider/index.js';
import { LivestreamSession } from '../../models/index.js';
import { resolveGuestViewerKey } from '../../utils/viewerStream.js';

export const issueShareCameraTokenController = async (context: Context) => {
  try {
    const sessionUser = context.get('user') as IdentitySessionUser | undefined;
    const externalUserId = sessionUser?.userId
      ? String(sessionUser.id ?? sessionUser.userId)
      : resolveGuestViewerKey(context);

    const livestreamId = context.req.param('livestreamId');
    if (!livestreamId) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
    }

    const livestream = await LivestreamSession.findById(livestreamId)
      .select('_id agoraChannelName agoraAppId status endedAt streamProvider')
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

    const publisher = await LivestreamProviderService.createShareCameraSession({
      channelName: livestream.agoraChannelName,
      externalUserId,
      expireSeconds: 3600,
    });

    logger.info({ livestreamId, externalUserId }, 'Share camera publisher token issued');

    return ResponseHandler.success(context, 'Share camera token issued.', {
      stream: {
        provider: publisher.provider,
        appId: publisher.appId ?? livestream.agoraAppId,
        channelName: publisher.channelName,
        token: publisher.hostToken,
        uid: publisher.uid ?? 0,
        role: 'audience' as const,
        expiresAt: publisher.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to issue share camera token');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_FETCH_FAILED, 500);
  }
};
