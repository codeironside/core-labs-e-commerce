import { config } from '@core/config';
import { PENDING_SIGNUP_PREFIX } from '@core/constants/pendingSignup';
import { getRedisClient } from '@core/services/redis';
import type { SignupRole } from '@api/AUTH/schemas';
import type { UserRole } from '@api/AUTH/models/user';

export interface PendingSignupRecord {
  name: string;
  email: string;
  passwordHash: string;
  signupRole: SignupRole;
  workspaceRole: UserRole;
  rememberMe: boolean;
  createdAt: string;
}

const buildKey = (email: string): string => `${PENDING_SIGNUP_PREFIX}${email.toLowerCase()}`;

export const setPendingSignup = async (record: PendingSignupRecord): Promise<void> => {
  await getRedisClient().setex(buildKey(record.email), config.otp.ttl, JSON.stringify(record));
};

export const getPendingSignup = async (email: string): Promise<PendingSignupRecord | null> => {
  const payload = await getRedisClient().get(buildKey(email));
  if (!payload) {
    return null;
  }
  return JSON.parse(payload) as PendingSignupRecord;
};

export const clearPendingSignup = async (email: string): Promise<void> => {
  await getRedisClient().del(buildKey(email));
};
