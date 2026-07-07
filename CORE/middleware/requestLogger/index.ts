import pinoHttp from 'pino-http';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import type { IncomingMessage } from 'node:http';
import { logger } from '../../logger';
import type { Request, Response } from 'express';

export const requestIdStorage = new AsyncLocalStorage<string>();

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req: Request) => {
    const existing = req.headers['x-request-id'];
    return (Array.isArray(existing) ? existing[0] : existing) ?? uuidv4();
  },
  customLogLevel(_req: Request, res: Response, err?: Error) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req: Request, res: Response) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage(req: Request, res: Response, err: Error) {
    return `${req.method} ${req.url} ${res.statusCode} — ${err?.message}`;
  },
  serializers: {
    req(req: Request) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: (req as IncomingMessage).socket?.remoteAddress,
      };
    },
    res(res: Response) {
      return { statusCode: res.statusCode };
    },
  },
});
