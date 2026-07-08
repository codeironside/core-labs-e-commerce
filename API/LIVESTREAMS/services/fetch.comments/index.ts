import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { LivestreamComment, LivestreamSession } from '../../models/index.js';
import { fetchLivestreamCommentsQuerySchema } from '../../schemas/index.js';
import { enrichCommentsWithAuthors } from '../../utils/commentAuthor.js';

export const fetchLivestreamCommentsController = async (c: Context) => {
    try {
        const livestreamId = c.req.param('livestreamId');
        if (!livestreamId) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

        const livestream = await LivestreamSession.findById(livestreamId).select('_id').lean();
        if (!livestream) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

        const parsed = fetchLivestreamCommentsQuerySchema.safeParse(c.req.query());
        if (!parsed.success) {
            throw new AppError(parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED, 400);
        }

        const { page, limit } = parsed.data;
        const skip = (page - 1) * limit;

        const [comments, total] = await Promise.all([
            LivestreamComment.find({ livestreamId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            LivestreamComment.countDocuments({ livestreamId }),
        ]);

        const enrichedComments = (await enrichCommentsWithAuthors(comments)).map((comment) => ({
            ...comment,
            _id: String(comment._id),
        }));

        logger.info({ livestreamId, total }, 'Livestream comments fetched');

        return ResponseHandler.success(
            c,
            'Comments fetched successfully.',
            { comments: enrichedComments },
            {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to fetch livestream comments');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
    }
};
