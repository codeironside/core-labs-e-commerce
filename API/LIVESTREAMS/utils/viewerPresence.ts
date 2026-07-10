import { redisClient } from '../../../CORE/services/cache/index.js';

const PRESENCE_TTL_MS = 45_000;

const presenceKey = (livestreamId: string): string => `livestream:${livestreamId}:presence`;

/** Heartbeat a viewer (auth user or guest_*) and return current live viewer count. */
export const touchViewerPresence = async (
  livestreamId: string,
  viewerKey: string,
): Promise<number> => {
  const key = presenceKey(livestreamId);
  const now = Date.now();
  const expiresAt = now + PRESENCE_TTL_MS;

  await redisClient.zadd(key, expiresAt, viewerKey);
  await redisClient.zremrangebyscore(key, 0, now);
  await redisClient.pexpire(key, PRESENCE_TTL_MS * 2);

  return redisClient.zcard(key);
};

export const getViewerPresenceCount = async (livestreamId: string): Promise<number> => {
  const key = presenceKey(livestreamId);
  const now = Date.now();
  await redisClient.zremrangebyscore(key, 0, now);
  return redisClient.zcard(key);
};
