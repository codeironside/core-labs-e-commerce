import crypto from 'node:crypto';
import { config } from '@core/config';
import { logger } from '@core/logger';
import { getRedisClient } from '@core/services/redis';
import { ONBOARDING_EMAIL_PREFIX, ONBOARDING_PENDING_PREFIX, ONBOARDING_REDIS_PREFIX, ONBOARDING_STEPS, ONBOARDING_USER_TYPES, } from '@core/constants/onboarding';
const normalizeEmail = (email) => email.trim().toLowerCase();
const buildStateKey = (token) => `${ONBOARDING_REDIS_PREFIX}${token}`;
const buildPendingKey = (userId) => `${ONBOARDING_PENDING_PREFIX}${userId}`;
const buildEmailKey = (email) => `${ONBOARDING_EMAIL_PREFIX}${normalizeEmail(email)}`;
const refreshIndexes = async (token, state) => {
    const redis = getRedisClient();
    const ttl = config.onboarding.ttlSeconds;
    await redis.setex(buildPendingKey(state.userId), ttl, token);
    await redis.setex(buildEmailKey(state.account.email), ttl, state.userId);
};
export const setOnboardingState = async (input) => {
    const token = crypto.randomUUID();
    const provisionalUserId = input.account.provisionalUserId;
    const isVendor = input.defaultUserType === ONBOARDING_USER_TYPES.VENDOR;
    const state = {
        userId: provisionalUserId,
        identifier: input.account.email,
        role: input.account.workspaceRole,
        requiresPhoneNumber: input.requiresPhoneNumber ?? false,
        rememberMe: input.rememberMe ?? false,
        currentStep: isVendor ? ONBOARDING_STEPS.GUIDELINES : ONBOARDING_STEPS.BASIC,
        draft: input.defaultUserType ? { userType: input.defaultUserType } : {},
        account: input.account,
        createdAt: new Date().toISOString(),
    };
    await getRedisClient().setex(buildStateKey(token), config.onboarding.ttlSeconds, JSON.stringify(state));
    await refreshIndexes(token, state);
    logger.info({ userId: provisionalUserId, token }, 'Onboarding state initialized');
    return token;
};
export const getOnboardingState = async (token) => {
    const payload = await getRedisClient().get(buildStateKey(token));
    if (!payload) {
        return null;
    }
    return JSON.parse(payload);
};
export const getOnboardingSessionByEmail = async (email) => {
    const provisionalUserId = await getRedisClient().get(buildEmailKey(email));
    if (!provisionalUserId) {
        return null;
    }
    const token = await getPendingOnboardingToken(provisionalUserId);
    if (!token) {
        return null;
    }
    const state = await getOnboardingState(token);
    if (!state) {
        return null;
    }
    return { token, state };
};
export const saveOnboardingDraft = async (token, patch, nextStep) => {
    const existing = await getOnboardingState(token);
    if (!existing) {
        throw new Error('ONBOARDING_SESSION_NOT_FOUND');
    }
    const updated = {
        ...existing,
        currentStep: nextStep,
        draft: { ...existing.draft, ...patch },
    };
    await getRedisClient().setex(buildStateKey(token), config.onboarding.ttlSeconds, JSON.stringify(updated));
    await refreshIndexes(token, updated);
    return updated;
};
export const patchOnboardingState = async (token, patch) => {
    const existing = await getOnboardingState(token);
    if (!existing) {
        return null;
    }
    const updated = { ...existing, ...patch };
    await getRedisClient().setex(buildStateKey(token), config.onboarding.ttlSeconds, JSON.stringify(updated));
    await refreshIndexes(token, updated);
    return updated;
};
export const clearOnboardingState = async (token, state) => {
    const resolvedState = state ?? (await getOnboardingState(token));
    await getRedisClient().del(buildStateKey(token));
    if (resolvedState) {
        await getRedisClient().del(buildPendingKey(resolvedState.userId));
        await getRedisClient().del(buildEmailKey(resolvedState.account.email));
    }
    logger.info({ token, userId: resolvedState?.userId }, 'Onboarding state cleared');
};
export const getPendingOnboardingToken = async (userId) => {
    return getRedisClient().get(buildPendingKey(userId));
};
export const extendOnboardingSession = async (token) => {
    const state = await getOnboardingState(token);
    if (!state) {
        return;
    }
    await getRedisClient().expire(buildStateKey(token), config.onboarding.ttlSeconds);
    await refreshIndexes(token, state);
};
