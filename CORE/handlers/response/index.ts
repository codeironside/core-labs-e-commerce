import type { Context } from 'hono';

export class ResponseHandler {
  static success<T>(
    context: Context,
    message: string,
    data?: T,
    meta?: Record<string, unknown>,
    status = 200,
  ) {
    return context.json(
      {
        success: true,
        message,
        ...(data !== undefined ? { data } : {}),
        ...(meta !== undefined ? { meta } : {}),
      },
      status as 200,
    );
  }
}
