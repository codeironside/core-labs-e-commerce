import crypto from 'node:crypto';
import { getRedisClient } from '@core/services/redis';
import type { OAuthUserProfile } from '@core/services/oauth';

const OAUTH_PENDING_TTL_SECONDS = 600;

const oauthPendingKey = (token: string): string => `oauth_pending:${token}`;

export async function createOAuthPendingSession(profile: OAuthUserProfile): Promise<string> {
  const token = crypto.randomUUID();
  await getRedisClient().setex(
    oauthPendingKey(token),
    OAUTH_PENDING_TTL_SECONDS,
    JSON.stringify(profile),
  );
  return token;
}

export async function consumeOAuthPendingSession(token: string): Promise<OAuthUserProfile | null> {
  const key = oauthPendingKey(token);
  const stored = await getRedisClient().get(key);
  if (!stored) {
    return null;
  }
  await getRedisClient().del(key);
  return JSON.parse(stored) as OAuthUserProfile;
}
