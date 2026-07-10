import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import {
  LivestreamAuction,
  LivestreamBid,
  LivestreamComment,
  LivestreamParticipant,
  LivestreamSession,
} from '../../models/index.js';
import { Order } from '../../../ORDERS/models/index.js';
import { assertLivestreamAccessibleInScope } from '../../../STORES/utils/vendorAnalyticsScope.js';

export const fetchLivestreamAnalyticsController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const livestreamId = context.req.param('livestreamId');
    if (!livestreamId) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

    await assertLivestreamAccessibleInScope(userId, livestreamId);

    const livestream = await LivestreamSession.findById(livestreamId)
      .select('_id title status endedAt createdAt recordingUrl metadata likeCount highlights')
      .lean();
    if (!livestream) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

    const [
      totalJoined,
      totalBids,
      totalComments,
      totalAuctions,
      closedAuctions,
      totalSales,
      amountRealisedResult,
      highlights,
    ] = await Promise.all([
      LivestreamParticipant.countDocuments({ livestreamId }),
      LivestreamBid.countDocuments({ livestreamId }),
      LivestreamComment.countDocuments({ livestreamId }),
      LivestreamAuction.countDocuments({ livestreamId }),
      LivestreamAuction.countDocuments({ livestreamId, status: 'closed' }),
      Order.countDocuments({ livestreamId, paymentStatus: 'paid' }),
      Order.aggregate<{ total: number }>([
        {
          $match: {
            livestreamId: new mongoose.Types.ObjectId(livestreamId),
            paymentStatus: 'paid',
          },
        },
        { $group: { _id: null, total: { $sum: '$breakdown.totalAmount' } } },
      ]),
      Promise.resolve(livestream.highlights ?? []),
    ]);

    const amountRealised = amountRealisedResult[0]?.total ?? 0;

    const peakViewers =
      typeof livestream.metadata?.peakViewerCount === 'number'
        ? livestream.metadata.peakViewerCount
        : totalJoined;

    return ResponseHandler.success(context, 'Livestream analytics fetched.', {
      analytics: {
        livestreamId,
        title: livestream.title,
        status: livestream.status,
        startedAt: livestream.createdAt,
        endedAt: livestream.endedAt,
        totalJoined,
        peakViewers,
        totalBids,
        totalComments,
        totalLikes: livestream.likeCount ?? 0,
        totalAuctions,
        closedAuctions,
        totalSales,
        amountRealised,
        currency: 'NGN',
        highlightCount: highlights.length,
        recordingUrl: livestream.recordingUrl ?? null,
        highlights,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch livestream analytics');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
  }
};
