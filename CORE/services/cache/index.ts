import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';

export const redisClient = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redisClient.on('error', (error) => logger.error({ error }, 'Redis error'));

export const connectRedis = async (): Promise<void> => {
  if (redisClient.status === 'ready' || redisClient.status === 'connecting') return;
  await redisClient.connect();
};
