import type { MiddlewareHandler } from "hono";
import { logger } from "../../services/logger/index.js";

export const httpLogger = (): MiddlewareHandler => async (c, next) => {
  const start = performance.now();

  await next();

  const end = performance.now();
  const duration = Math.round(end - start);

  const logData = {
    method: c.req.method,
    url: c.req.url,
    status: c.res.status,
    durationMs: duration,
    ip: c.req.header("x-forwarded-for") || "unknown",
  };

  if (c.res.status >= 400) {
    logger.warn(logData, "HTTP Request completed with an error status");
  } else {
    logger.info(logData, "HTTP Request completed");
  }
};
