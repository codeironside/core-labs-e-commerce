import type { Context } from 'hono';
import mongoose from 'mongoose';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { LivestreamComment, LivestreamSession } from '../../../LIVESTREAMS/models/index.js';

const parseObjectId = (value: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError('Invalid identifier.', 400);
  }
  return new mongoose.Types.ObjectId(value);
};

export const listLivestreamCommentsController = async (context: Context) => {
  const page = Math.max(1, Number(context.req.query('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(context.req.query('limit') ?? 30)));
  const skip = (page - 1) * limit;
  const livestreamIdParam = context.req.query('livestreamId');

  const filter: Record<string, unknown> = {};
  if (livestreamIdParam) {
    filter.livestreamId = parseObjectId(String(livestreamIdParam));
  }

  const [comments, total] = await Promise.all([
    LivestreamComment.find(filter)
      .select('livestreamId userId message createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LivestreamComment.countDocuments(filter),
  ]);

  const livestreamIds = [...new Set(comments.map((comment) => String(comment.livestreamId)))];
  const livestreams = livestreamIds.length
    ? await LivestreamSession.find({ _id: { $in: livestreamIds } })
        .select('title vendorId status')
        .lean()
    : [];
  const livestreamMap = new Map(livestreams.map((session) => [String(session._id), session]));

  return ResponseHandler.success(context, 'Livestream comments', {
    items: comments.map((comment) => ({
      ...comment,
      livestream: livestreamMap.get(String(comment.livestreamId)) ?? null,
    })),
    total,
    page,
    limit,
  });
};

export const deleteLivestreamCommentController = async (context: Context) => {
  const commentId = parseObjectId(String(context.req.param('commentId') ?? ''));
  const deleted = await LivestreamComment.findByIdAndDelete(commentId).lean();
  if (!deleted) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.NOT_FOUND, 404);
  }

  return ResponseHandler.success(context, 'Comment deleted', { commentId: String(commentId) });
};

export const listLivestreamsForModerationController = async (context: Context) => {
  const page = Math.max(1, Number(context.req.query('page') ?? 1));
  const limit = Math.min(50, Math.max(1, Number(context.req.query('limit') ?? 20)));
  const skip = (page - 1) * limit;

  const [livestreams, total] = await Promise.all([
    LivestreamSession.find({})
      .select(
        'title status vendorId createdAt endedAt recordingUrl recordingPublic recordingEnabled adminRecordingOverride highlights',
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LivestreamSession.countDocuments({}),
  ]);

  const livestreamIds = livestreams.map((session) => session._id);
  const commentCounts = livestreamIds.length
    ? await LivestreamComment.aggregate([
        { $match: { livestreamId: { $in: livestreamIds } } },
        { $group: { _id: '$livestreamId', commentCount: { $sum: 1 } } },
      ])
    : [];
  const commentCountMap = new Map(
    commentCounts.map((row) => [String(row._id), row.commentCount as number]),
  );

  return ResponseHandler.success(context, 'Livestreams for moderation', {
    items: livestreams.map((session) => ({
      ...session,
      commentCount: commentCountMap.get(String(session._id)) ?? 0,
    })),
    total,
    page,
    limit,
  });
};
