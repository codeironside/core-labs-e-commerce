import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import type { Context } from 'hono';

export const register = new Registry();

register.setDefaultLabels({
    app: 'core labs e-commerce',
});

collectDefaultMetrics({ register });

export const httpRequestDurationMicroseconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in microseconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});
register.registerMetric(httpRequestDurationMicroseconds);

export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'code'],
});
register.registerMetric(httpRequestsTotal);

export const metricsHandler = async (c: Context) => {
    c.header('Content-Type', register.contentType);
    return c.text(await register.metrics());
};
