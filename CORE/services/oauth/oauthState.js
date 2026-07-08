import crypto from 'node:crypto';
import { getRedisClient } from '@core/services/redis';
const OAUTH_STATE_TTL_SECONDS = 600;
const oauthStateKey = (state) => `oauth_state:${state}`;
export async function createOAuthState(payload) {
    const state = crypto.randomUUID();
    await getRedisClient().setex(oauthStateKey(state), OAUTH_STATE_TTL_SECONDS, JSON.stringify(payload));
    return state;
}
export async function consumeOAuthState(state) {
    const key = oauthStateKey(state);
    const stored = await getRedisClient().get(key);
    if (!stored) {
        return null;
    }
    await getRedisClient().del(key);
    return JSON.parse(stored);
}
