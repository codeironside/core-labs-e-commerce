import type { Context } from 'hono';

import { logger } from '../../../../CORE/services/logger/index.js';

import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';

import { AppError } from '../../../../CORE/handlers/error/index.js';

import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';

import type { IdentitySessionUser } from '../../../../CORE/middlewares/auth/index.js';

import { publishLivestreamEvent } from '../../../../CORE/services/realtime/index.js';

import { LivestreamParticipant, LivestreamSession } from '../../models/index.js';

import { Product } from '../../../PRODUCTS/models/index.js';

import { User } from '../../../AUTH/models/index.js';

import { assertUserCanJoinStream } from '../../../../CORE/services/livestreamConcurrency/index.js';

import { buildViewerStreamPayload, resolveGuestViewerKey } from '../../utils/viewerStream.js';
import { touchViewerPresence } from '../../utils/viewerPresence.js';
import { resolveCoverImageUrl } from '../../utils/coverImage.js';
import { resolveLivestreamHostUser } from '../../../STORES/utils/storeAccess.js';
import { resolveHostBroadcastCredentials } from '../../utils/hostBroadcast.js';



export const joinLivestreamController = async (context: Context) => {

  try {

    const sessionUser = context.get('user') as IdentitySessionUser | undefined;

    const isGuest = !sessionUser?.userId;

    const userId = isGuest ? resolveGuestViewerKey(context) : String(sessionUser!.id ?? sessionUser!.userId);

    const livestreamId = context.req.param('livestreamId');

    if (!livestreamId) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);



    if (!isGuest) {

      const viewer = await User.findById(userId).select('livestreamBanned platformBanned').lean();

      if (viewer?.platformBanned) {

        throw new AppError('Your account is suspended from the platform.', 403);

      }

      if (viewer?.livestreamBanned) {

        throw new AppError('You are banned from joining livestreams.', 403);

      }

    }



    const livestream = await LivestreamSession.findById(livestreamId)

      .select(

        '_id agoraChannelName agoraAppId hostToken hostTokenExpiresAt title description recordingEnabled listedProductIds bannedUserIds vendorId hostUserId status endedAt agoraHostUid streamProvider playbackUrl ingestUrl metadata createdAt likeCount',

      )

      .lean();



    if (!livestream) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);



    const ended =

      livestream.status === 'ended'

      || livestream.status === 'cancelled'

      || Boolean(livestream.endedAt);

    if (ended) {

      throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_ENDED, 410);

    }



    if (!isGuest) {

      const isBannedFromStream = (livestream.bannedUserIds ?? []).some(

        (bannedId) => String(bannedId) === userId,

      );

      if (isBannedFromStream) {

        throw new AppError('You have been removed from this livestream.', 403);

      }

    }



    const isHost = !isGuest && resolveLivestreamHostUser(
      userId,
      String(livestream.vendorId),
      livestream.hostUserId ? String(livestream.hostUserId) : undefined,
    );



    if (isHost) {

      await assertUserCanJoinStream(userId, livestreamId, true);

    } else if (!isGuest) {

      await assertUserCanJoinStream(userId, livestreamId, false);

    }



    const [vendor, products, participant] = await Promise.all([

      User.findById(livestream.vendorId).select('name').lean(),

      Product.find({ _id: { $in: livestream.listedProductIds ?? [] } })

        .select('_id name pricing media shortDescription')

        .lean(),

      isGuest

        ? Promise.resolve(null)

        : LivestreamParticipant.findOneAndUpdate(

            { livestreamId, userId },

            { $setOnInsert: { livestreamId, userId, joinedAt: new Date() } },

            { upsert: true, new: true },

          ).lean(),

    ]);



    const streamPayload = isHost
      ? await (async () => {
          const hostBroadcast = await resolveHostBroadcastCredentials(livestream);
          return {
            provider: livestream.streamProvider ?? 'agora',
            appId: livestream.agoraAppId,
            channelName: livestream.agoraChannelName,
            token: hostBroadcast.hostToken,
            uid: hostBroadcast.hostUid,
            hostUid: hostBroadcast.hostUid,
            role: 'host' as const,
            expiresAt: hostBroadcast.expiresAt ?? livestream.hostTokenExpiresAt,
            playbackUrl: livestream.playbackUrl,
            ingestUrl: livestream.ingestUrl,
          };
        })()
      : await buildViewerStreamPayload(livestream, userId);



    if (!isHost && !isGuest) {

      await publishLivestreamEvent(livestreamId, {

        type: 'viewer.joined',

        livestreamId,

        userId,

        joinedAt: new Date().toISOString(),

      });

    }



    const viewerCount = await touchViewerPresence(livestreamId, userId);

    if (viewerCount > 0) {
      const currentPeak =
        typeof livestream.metadata?.peakViewerCount === 'number'
          ? livestream.metadata.peakViewerCount
          : 0;
      if (viewerCount > currentPeak) {
        await LivestreamSession.updateOne(
          { _id: livestreamId },
          { $set: { 'metadata.peakViewerCount': viewerCount } },
        );
      }
    }

    logger.info({ livestreamId, userId, provider: streamPayload.provider, isHost, isGuest }, 'Livestream joined');

    return ResponseHandler.success(
      context,
      SYSTEM_MESSAGES.SUCCESS.LIVESTREAM_JOINED,
      {
        participant,
        session: {

          id: String(livestream._id),

          title: livestream.title,

          description: livestream.description,

          status: livestream.status,

          recordingEnabled: livestream.recordingEnabled,

          listedProductIds: (livestream.listedProductIds ?? []).map(String),

          vendorId: String(livestream.vendorId),

          vendorName: vendor?.name ?? 'Vendor',

          createdAt: livestream.createdAt,

          coverImageUrl: resolveCoverImageUrl(livestream.metadata),

          likeCount: livestream.likeCount ?? 0,

        },

        products,

        stream: streamPayload,

        viewerCount,

        likeCount: livestream.likeCount ?? 0,

        isHost,

        isGuest,

        permissions: {

          canComment: !isGuest,

          canBid: !isGuest,

          canPurchase: !isGuest,

          requiresAuthForInteraction: isGuest,

        },

      },

    );

  } catch (error) {

    if (error instanceof AppError) throw error;

    logger.error({ error }, 'Failed to join livestream');

    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_FETCH_FAILED, 500);

  }

};

