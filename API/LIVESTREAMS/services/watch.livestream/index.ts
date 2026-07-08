import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import type { IdentitySessionUser } from '../../../../CORE/middlewares/auth/index.js';
import { LivestreamParticipant, LivestreamSession } from '../../models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { User } from '../../../AUTH/models/index.js';
import { buildViewerStreamPayload, resolveGuestViewerKey } from '../../utils/viewerStream.js';
import { resolveCoverImageUrl } from '../../utils/coverImage.js';
import { resolveLivestreamHostUser } from '../../../STORES/utils/storeAccess.js';

export const watchLivestreamController = async (context: Context) => {
  try {
    const livestreamId = context.req.param('livestreamId');
    if (!livestreamId) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
    }

    const livestream = await LivestreamSession.findById(livestreamId)
      .select(
        '_id title description vendorId hostUserId status endedAt listedProductIds playbackUrl agoraAppId agoraChannelName hostTokenExpiresAt agoraHostUid streamProvider recordingEnabled createdAt metadata',
      )
      .lean();

    if (!livestream) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
    }

    const ended =
      livestream.status === 'ended' ||
      livestream.status === 'cancelled' ||
      Boolean(livestream.endedAt);

    const [vendor, products] = await Promise.all([
      User.findById(livestream.vendorId).select('name vendorProfile').lean(),
      Product.find({ _id: { $in: livestream.listedProductIds ?? [] } })
        .select('_id name pricing media shortDescription auctionSettings version')
        .lean(),
    ]);

    const sessionUser = context.get('user') as IdentitySessionUser | undefined;
    const isAuthenticated = Boolean(sessionUser?.userId);
    const isHost = isAuthenticated && resolveLivestreamHostUser(
      String(sessionUser!.userId),
      String(livestream.vendorId),
      livestream.hostUserId ? String(livestream.hostUserId) : undefined,
    );
    const viewerKey = isAuthenticated
      ? String(sessionUser!.userId)
      : resolveGuestViewerKey(context);

    if (isAuthenticated && !ended) {
      await LivestreamParticipant.findOneAndUpdate(
        { livestreamId, userId: sessionUser!.userId },
        { $setOnInsert: { livestreamId, userId: sessionUser!.userId, joinedAt: new Date() } },
        { upsert: true },
      );
    }

    const viewerCount = await LivestreamParticipant.countDocuments({ livestreamId });

    const streamPayload = ended
      ? {
          provider: livestream.streamProvider ?? 'agora',
          playbackUrl: livestream.playbackUrl ?? null,
        }
      : await buildViewerStreamPayload(livestream, viewerKey);

    logger.info({ livestreamId, isAuthenticated, viewerCount }, 'Public livestream watch');

    return ResponseHandler.success(context, 'Livestream session loaded.', {
      isHost,
      isGuest: !isAuthenticated,
      session: {
        id: String(livestream._id),
        title: livestream.title,
        description: livestream.description,
        status: ended ? 'ended' : (livestream.status ?? 'active'),
        vendorId: String(livestream.vendorId),
        vendorName: vendor?.name ?? 'Vendor',
        listedProductIds: (livestream.listedProductIds ?? []).map(String),
        recordingEnabled: livestream.recordingEnabled,
        createdAt: livestream.createdAt,
        coverImageUrl: resolveCoverImageUrl(livestream.metadata),
      },
      products,
      stream: streamPayload,
      viewerCount,
      guestViewerId: isAuthenticated ? undefined : viewerKey.replace(/^guest_/, ''),
      permissions: {
        canComment: isAuthenticated,
        canBid: isAuthenticated,
        canPurchase: isAuthenticated,
        requiresAuthForInteraction: !isAuthenticated,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to watch livestream');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_FETCH_FAILED, 500);
  }
};
