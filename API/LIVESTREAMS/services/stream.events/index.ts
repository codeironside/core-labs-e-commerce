import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { createLivestreamSubscriber } from '../../../../CORE/services/realtime/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { LivestreamSession } from '../../models/index.js';

export const streamLivestreamEventsController = async (c: Context) => {
    const livestreamId = c.req.param('livestreamId');
    if (!livestreamId) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

    const livestream = await LivestreamSession.findById(livestreamId)
        .select('_id status endedAt')
        .lean();
    if (!livestream) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

    const ended =
        livestream.status === 'ended' ||
        livestream.status === 'cancelled' ||
        Boolean(livestream.endedAt);
    if (ended) {
        throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_ENDED, 410);
    }

    c.header('Cache-Control', 'no-cache, no-transform');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
        let closed = false;
        const unsubscribe = await createLivestreamSubscriber(livestreamId, async (event) => {
            if (closed) return;
            await stream.writeSSE({
                event: event.type,
                data: JSON.stringify(event),
            });
        });

        await stream.writeSSE({
            event: 'connected',
            data: JSON.stringify({
                livestreamId,
                connectedAt: new Date().toISOString(),
            }),
        });

        const heartbeat = setInterval(() => {
            stream.writeSSE({
                event: 'heartbeat',
                data: JSON.stringify({ livestreamId, ts: new Date().toISOString() }),
            }).catch(() => undefined);
        }, 15000);

        await new Promise<void>((resolve) => {
            stream.onAbort(() => {
                closed = true;
                clearInterval(heartbeat);
                unsubscribe().finally(resolve);
            });
        });
    });
};
