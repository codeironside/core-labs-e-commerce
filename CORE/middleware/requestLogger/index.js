import pinoHttp from 'pino-http';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger';
export const requestIdStorage = new AsyncLocalStorage();
export const requestLogger = pinoHttp({
    logger,
    genReqId: (req) => {
        const existing = req.headers['x-request-id'];
        return (Array.isArray(existing) ? existing[0] : existing) ?? uuidv4();
    },
    customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessMessage(req, res) {
        return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage(req, res, err) {
        return `${req.method} ${req.url} ${res.statusCode} — ${err?.message}`;
    },
    serializers: {
        req(req) {
            return {
                id: req.id,
                method: req.method,
                url: req.url,
                remoteAddress: req.socket?.remoteAddress,
            };
        },
        res(res) {
            return { statusCode: res.statusCode };
        },
    },
});
