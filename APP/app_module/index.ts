import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Server as HttpServer } from 'node:http';
import { config } from '../../CORE/config/index.js';
import { connectDatabase, disconnectDatabase } from '../../CORE/services/db/index.js';
import { connectRedis, redisClient } from '../../CORE/services/cache/index.js';
import { connectKafkaProducer, disconnectKafkaProducer } from '../../CORE/services/kafka/index.js';
import { initLivestreamSocket } from '../../CORE/services/socket/index.js';
import { setupCoreMiddlewares } from '../../CORE/handlers/core/index.js';
import { mountAppRouter } from '../app_route/index.js';
import { logger } from '../../CORE/services/logger/index.js';

const bootstrap = async (): Promise<void> => {
  logger.info('[SYS] Booting e-commerce service...');

  if (!config.app.NODE_ENV || !config.app.port) {
    throw new Error('Critical environment variables missing.');
  }

  logger.info('[CHK] Initializing Redis...');
  await connectRedis();
  if (redisClient.status !== 'ready' && redisClient.status !== 'connecting') {
    throw new Error('Redis instance is unreachable.');
  }

  logger.info('[CHK] Connecting to MongoDB...');
  await connectDatabase();

  logger.info('[CHK] Connecting Kafka producer...');
  await connectKafkaProducer();

  logger.info('[CHK] Mounting API modules...');
  const app = new OpenAPIHono({ strict: false });
  setupCoreMiddlewares(app);
  mountAppRouter(app);

  const port = Number(config.app.port);
  const httpServer = serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`[SYS] E-commerce service listening on http://localhost:${info.port} (HTTP + livestream sockets)`);
  });

  await initLivestreamSocket(httpServer as HttpServer);
  const { startAuctionExpiryScheduler } = await import('../../CORE/services/auctionExpiry/index.js');
  startAuctionExpiryScheduler();
  const { startCommerceKafkaConsumer } = await import('../../CORE/services/kafka/consumer.js');
  await startCommerceKafkaConsumer();
};

const shutdown = async (signal: string): Promise<void> => {
  logger.warn({ signal }, 'Shutdown signal received');
  await disconnectKafkaProducer();
  await disconnectDatabase();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

bootstrap().catch((error) => {
  logger.fatal({ error }, '[FATAL] Failed to bootstrap e-commerce service');
  process.exit(1);
});
