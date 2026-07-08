import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { broadcastLivestreamEvent } from '../../../../CORE/services/livestreamBroadcast/index.js';
import { emitToLivestreamRoom } from '../../../../CORE/services/socket/index.js';
import { LivestreamRecordingService } from '../../../../CORE/services/livestreams/recording/index.js';
import { processLivestreamHighlightClips } from '../../../../CORE/services/livestreams/highlights/processor.js';
import { LivestreamSession } from '../../models/index.js';
import { User } from '../../../AUTH/models/index.js';

export const endLivestreamController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const vendorId = String(sessionUser.id ?? sessionUser._id);
        const vendor = await User.findById(vendorId).select('userType').lean();

        if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const { livestreamId } = c.req.param() as { livestreamId: string };

        const existing = await LivestreamSession.findOne({ _id: livestreamId, vendorId }).lean();

        if (!existing) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

        const endedAtDate = new Date();
        const update: Record<string, unknown> = {
            status: 'ended',
            endedAt: endedAtDate,
        };

        if (existing.recordingEnabled) {
            const recordingUrl = await LivestreamRecordingService.stopAndResolveUrl(existing);
            if (recordingUrl) {
                update.recordingUrl = recordingUrl;
                const clipCount = await processLivestreamHighlightClips(livestreamId, recordingUrl);
                logger.info({ livestreamId, clipCount }, 'Post-stream highlight clips generated');
            }
        }

        await LivestreamSession.findOneAndUpdate({ _id: livestreamId, vendorId }, { $set: update });

        const endedAt = endedAtDate.toISOString();

        await broadcastLivestreamEvent(livestreamId, {
            type: 'livestream.ended',
            livestreamId,
            status: 'ended',
            endedAt,
        });

        emitToLivestreamRoom(livestreamId, 'livestream:force-disconnect', {
            livestreamId,
            reason: 'ended',
        });

        logger.info({ vendorId, livestreamId }, 'Livestream ended by vendor');

        return ResponseHandler.success(c, 'Livestream ended successfully.', {
            livestreamId,
            status: 'ended',
            endedAt,
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to end livestream');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_FETCH_FAILED, 500);
    }
};
