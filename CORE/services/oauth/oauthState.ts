import crypto from 'node:crypto';
import { getRedisClient } from '@core/services/redis';
import type { SignupRole } from '@api/AUTH/schemas';

const OAUTH_STATE_TTL_SECONDS = 600;

type OAuthStatePayload = {
  signupRole?: SignupRole;
  intent: 'signup' | 'login';
};

const oauthStateKey = (state: string): string => `oauth_state:${state}`;

export async function createOAuthState(payload: OAuthStatePayload): Promise<string> {
  const state = crypto.randomUUID();
  await getRedisClient().setex(oauthStateKey(state), OAUTH_STATE_TTL_SECONDS, JSON.stringify(payload));
  return state;
}

export async function consumeOAuthState(state: string): Promise<OAuthStatePayload | null> {
  const key = oauthStateKey(state);
  const stored = await getRedisClient().get(key);
  if (!stored) {
    return null;
  }
  await getRedisClient().del(key);
  return JSON.parse(stored) as OAuthStatePayload;
}
