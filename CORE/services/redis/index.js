import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
let instance = null;
function createRedisClient(options = {}) {
    const client = new Redis(config.redis.url, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        retryStrategy(times) {
            const delay = Math.min(config.db.retryDelayMs * Math.pow(2, times), 30000);
            if (times <= 3) {
                logger.warn({ times, delay }, 'Redis retry (is Redis running? REDIS_URL)');
            }
            else {
                logger.debug({ times, delay }, 'Redis retry');
            }
            return delay;
        },
        ...options,
    });
    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', (err) => logger.error({ err }, 'Redis error'));
    client.on('close', () => logger.warn('Redis connection closed'));
    return client;
}
export function getRedisClient() {
    if (!instance) {
        instance = createRedisClient();
    }
    return instance;
}
export async function connectRedis() {
    const client = getRedisClient();
    if (client.status === 'connecting' || client.status === 'connect' || client.status === 'ready') {
        return;
    }
    await client.connect();
    try {
        const configResult = (await client.config('GET', 'maxmemory-policy'));
        if (configResult && configResult[1] !== 'noeviction') {
            logger.warn({ currentPolicy: configResult[1] }, 'Redis eviction policy is NOT "noeviction". BullMQ requires "noeviction" to prevent job loss.');
        }
    }
    catch {
        logger.debug('Could not verify Redis eviction policy (CONFIG may be disabled)');
    }
}
export async function disconnectRedis() {
    if (instance) {
        await instance.quit();
        instance = null;
        logger.info('Redis disconnected');
    }
}
export const storeJsonPayload = async (key, data, ttlSeconds = 900) => {
    try {
        const payload = JSON.stringify(data);
        await getRedisClient().setex(key, ttlSeconds, payload);
    }
    catch (err) {
        logger.error({ err, key }, 'Failed to store JSON payload in Redis');
        throw err;
    }
};
export const getJsonPayload = async (key) => {
    try {
        const payload = await getRedisClient().get(key);
        return payload ? JSON.parse(payload) : null;
    }
    catch (err) {
        logger.error({ err, key }, 'Failed to retrieve JSON payload from Redis');
        throw err;
    }
};
