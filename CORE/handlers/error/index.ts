import type { Context } from 'hono';
import type { HTTPResponseError } from 'hono/types';
import { AppError } from '@core-labs/platform-core';
import { logger } from '../../services/logger/index.js';
import { config } from '../../config/index.js';

export { AppError };

const isValidHttpStatusCode = (status: unknown): status is number =>
  typeof status === 'number' && Number.isInteger(status) && status >= 200 && status <= 599;

export const errorHandler = (err: Error | HTTPResponseError | AppError, c: Context) => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if ('status' in err && isValidHttpStatusCode(err.status)) {
    statusCode = err.status;
    message = err.message;
  }

  logger.error({ err, path: c.req.path }, err.message);

  return c.json(
    {
      success: false,
      message,
      ...(config.app.NODE_ENV === 'development' && { stack: err.stack }),
    },
    statusCode as 500,
  );
};
