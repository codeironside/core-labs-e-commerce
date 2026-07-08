import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { ROLE_NAMES, SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { LivestreamSession } from '../../models/index.js';

export const fetchLivestreamController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const vendorId = String(sessionUser.id ?? sessionUser._id);
        const vendor = await User.findById(vendorId).select('role userType').lean();

        if (!vendor || vendor.role !== ROLE_NAMES.VENDOR || vendor.userType !== ROLE_NAMES.VENDOR) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const livestreamId = c.req.param('livestreamId');
        if (!livestreamId) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
        }

        const livestream = await LivestreamSession.findOne({
            _id: livestreamId,
            vendorId,
        }).lean();

        if (!livestream) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
        }

        logger.info({ vendorId, livestreamId }, 'Vendor livestream fetched');

        return ResponseHandler.success(
            c,
            SYSTEM_MESSAGES.SUCCESS.LIVESTREAM_FETCHED,
            { livestream },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to fetch livestream');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_FETCH_FAILED, 500);
    }
};
