import { config } from '@core/config';
import { PENDING_SIGNUP_PREFIX } from '@core/constants/pendingSignup';
import { getRedisClient } from '@core/services/redis';
const buildKey = (email) => `${PENDING_SIGNUP_PREFIX}${email.toLowerCase()}`;
export const setPendingSignup = async (record) => {
    await getRedisClient().setex(buildKey(record.email), config.otp.ttl, JSON.stringify(record));
};
export const getPendingSignup = async (email) => {
    const payload = await getRedisClient().get(buildKey(email));
    if (!payload) {
        return null;
    }
    return JSON.parse(payload);
};
export const clearPendingSignup = async (email) => {
    await getRedisClient().del(buildKey(email));
};
