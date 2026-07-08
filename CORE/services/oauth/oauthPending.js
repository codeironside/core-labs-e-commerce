import crypto from 'node:crypto';
import { getRedisClient } from '@core/services/redis';
const OAUTH_PENDING_TTL_SECONDS = 600;
const oauthPendingKey = (token) => `oauth_pending:${token}`;
export async function createOAuthPendingSession(profile) {
    const token = crypto.randomUUID();
    await getRedisClient().setex(oauthPendingKey(token), OAUTH_PENDING_TTL_SECONDS, JSON.stringify(profile));
    return token;
}
export async function consumeOAuthPendingSession(token) {
    const key = oauthPendingKey(token);
    const stored = await getRedisClient().get(key);
    if (!stored) {
        return null;
    }
    await getRedisClient().del(key);
    return JSON.parse(stored);
}
