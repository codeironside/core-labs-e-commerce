import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import type { IdentitySessionUser } from '../../../../CORE/middlewares/auth/index.js';
import { broadcastLivestreamEvent } from '../../../../CORE/services/livestreamBroadcast/index.js';
import { LivestreamComment, LivestreamParticipant, LivestreamSession } from '../../models/index.js';
import { createCommentSchema } from '../../schemas/index.js';
import { resolveCommentAuthor } from '../../utils/commentAuthor.js';

export const createCommentController = async (c: Context) => {
    try {
        const sessionUser = c.get('user') as IdentitySessionUser | undefined;
        if (!sessionUser?.userId) {
            const authHeader = c.req.header('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
            }
            throw new AppError(SYSTEM_MESSAGES.ERRORS.GUEST_COMMENT_FORBIDDEN, 403);
        }

        const userId = String(sessionUser.userId);
        const livestreamId = c.req.param('livestreamId');
        if (!livestreamId) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

        const livestream = await LivestreamSession.findById(livestreamId).select('_id status endedAt').lean();
        if (!livestream) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

        const ended =
            livestream.status === 'ended'
            || livestream.status === 'cancelled'
            || Boolean(livestream.endedAt);
        if (ended) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_ENDED, 410);
        }

        const body = await c.req.json().catch(() => ({}));
        const parsed = createCommentSchema.safeParse(body);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED, 400);
        }

        await LivestreamParticipant.findOneAndUpdate(
            { livestreamId, userId },
            { $setOnInsert: { livestreamId, userId, joinedAt: new Date() } },
            { upsert: true, new: true },
        );

        const comment = await LivestreamComment.create({
            livestreamId,
            userId,
            message: parsed.data.message,
        });

        const author = await resolveCommentAuthor(userId);

        const eventPayload = {
            type: 'comment.created' as const,
            livestreamId,
            commentId: String(comment._id),
            userId,
            message: comment.message,
            createdAt: comment.createdAt.toISOString(),
            isGuest: false,
            authorName: author.authorName,
            ...(author.authorAvatar ? { authorAvatar: author.authorAvatar } : {}),
        };

        await broadcastLivestreamEvent(livestreamId, eventPayload);

        logger.info({ livestreamId, commentId: comment._id, userId }, 'Livestream comment created');

        return ResponseHandler.success(c, 'Comment created successfully.', {
            comment: {
                ...comment.toObject(),
                ...author,
            },
        }, undefined, 201);
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to create livestream comment');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
    }
};
