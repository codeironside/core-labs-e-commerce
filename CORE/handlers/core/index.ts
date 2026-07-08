import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { httpLogger } from "../../middlewares/http-logger/index.js";
import { attachIdentityAuth, attachOptionalIdentityAuth } from "../../middlewares/auth/index.js";
import { config } from "../../config/index.js";
import { errorHandler } from "../error/index.js";
import { setupDocs } from "../../services/docs/index.js";
import { metricsHandler } from "../../monitoring/metrics/index.js";
import { healthCheckHandler } from "../../monitoring/health/index.js";
import { API_VERSION } from "../../constants/kafka/index.js";

const PUBLIC_ROUTE_PREFIXES = [
  `${API_VERSION}/health`,
  `${API_VERSION}/metrics`,
  `${API_VERSION}/docs`,
  `${API_VERSION}/openapi`,
  `${API_VERSION}/stores/public`,
] as const;

const LIVESTREAM_OBJECT_ID = '[a-fA-F0-9]{24}';

const OPTIONAL_AUTH_GET_PATTERNS = [
  new RegExp(`^${API_VERSION}/livestreams/active$`),
  new RegExp(`^${API_VERSION}/livestreams/${LIVESTREAM_OBJECT_ID}/watch$`),
  new RegExp(`^${API_VERSION}/livestreams/${LIVESTREAM_OBJECT_ID}/comments$`),
  new RegExp(`^${API_VERSION}/livestreams/${LIVESTREAM_OBJECT_ID}/auctions/open$`),
  new RegExp(`^${API_VERSION}/livestreams/${LIVESTREAM_OBJECT_ID}/events$`),
  new RegExp(`^${API_VERSION}/products$`),
  new RegExp(`^${API_VERSION}/products/search/suggest$`),
  new RegExp(`^${API_VERSION}/products/[^/]+$`),
] as const;

const OPTIONAL_AUTH_POST_PATTERNS = [
  new RegExp(`^${API_VERSION}/livestreams/${LIVESTREAM_OBJECT_ID}/join$`),
  new RegExp(`^${API_VERSION}/livestreams/${LIVESTREAM_OBJECT_ID}/share-camera/token$`),
  new RegExp(`^${API_VERSION}/livestreams/${LIVESTREAM_OBJECT_ID}/comments$`),
] as const;

const isOptionalAuthGet = (path: string, method: string): boolean =>
  method === 'GET' && OPTIONAL_AUTH_GET_PATTERNS.some((pattern) => pattern.test(path));

const isOptionalAuthPost = (path: string, method: string): boolean =>
  method === 'POST' && OPTIONAL_AUTH_POST_PATTERNS.some((pattern) => pattern.test(path));

export const setupCoreMiddlewares = (app: OpenAPIHono) => {
  app.onError(errorHandler);

  app.use(httpLogger());

  app.use(
    "*",
    cors({
      origin: config.app.corsOrigin,
      allowHeaders: ["Content-Type", "Authorization", "x-guest-viewer-id"],
      allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.use("*", async (context, next) => {
    if (context.req.method === "OPTIONS") {
      await next();
      return;
    }

    const path = new URL(context.req.url).pathname;
    if (PUBLIC_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      await next();
      return;
    }
    if (isOptionalAuthGet(path, context.req.method) || isOptionalAuthPost(path, context.req.method)) {
      await attachOptionalIdentityAuth(context, next);
      return;
    }
    await attachIdentityAuth(context, next);
  });

  setupDocs(app);

  app.get(`${API_VERSION}/metrics`, metricsHandler);
  app.get(`${API_VERSION}/health`, healthCheckHandler);
};
