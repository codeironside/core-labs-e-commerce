import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';

const PRIVY_BASE_URL = 'https://auth.privy.io/api/v1';
const PRIVY_JWKS_TTL_MS = 3_600_000;

type PrivyUserResponse = {
  id?: string;
  email?: string;
  linked_accounts?: Array<{
    type: string;
    address?: string;
    chain_type?: string;
    email?: string;
  }>;
  wallet?: {
    address?: string;
    chain_type?: string;
  };
  wallets?: Array<{
    address?: string;
    chain_type?: string;
  }>;
};

type JwksKey = {
  kid?: string;
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
};

type JwksResponse = {
  keys: JwksKey[];
};

export type PrivyWalletProvisionResult = {
  privyUserId?: string;
  walletAddress?: string;
};

export type PrivyValidatedSession = {
  privyUserId: string;
  walletAddress: string;
  email?: string;
};

const isPrivyConfigured = (): boolean => Boolean(config.privy.appId && config.privy.appSecret);

let cachedJwks: JwksResponse | null = null;
let jwksFetchedAt = 0;

const getAuthHeader = (): string =>
  `Basic ${Buffer.from(`${config.privy.appId}:${config.privy.appSecret}`).toString('base64')}`;

const privyHeaders = (): Record<string, string> => ({
  Authorization: getAuthHeader(),
  'Content-Type': 'application/json',
  'privy-app-id': config.privy.appId,
});

const extractSolanaAddress = (payload: PrivyUserResponse | null | undefined): string | undefined => {
  if (!payload) {
    return undefined;
  }
  if (payload.wallet?.chain_type === 'solana' && payload.wallet.address) {
    return payload.wallet.address;
  }
  const nestedWallet = payload.wallets?.find((wallet) => wallet.chain_type === 'solana' && wallet.address);
  if (nestedWallet?.address) {
    return nestedWallet.address;
  }
  const linkedWallet = payload.linked_accounts?.find(
    (account) => account.type === 'wallet' && account.chain_type === 'solana' && account.address,
  );
  return linkedWallet?.address;
};

const extractEmail = (payload: PrivyUserResponse | null | undefined): string | undefined => {
  if (!payload) {
    return undefined;
  }
  if (payload.email) {
    return payload.email;
  }
  const linkedEmail = payload.linked_accounts?.find((account) => account.type === 'email' && account.address);
  return linkedEmail?.address ?? linkedEmail?.email;
};

const fetchJwks = async (): Promise<JwksResponse> => {
  const now = Date.now();
  if (cachedJwks && now - jwksFetchedAt < PRIVY_JWKS_TTL_MS) {
    return cachedJwks;
  }

  const res = await fetch(`${PRIVY_BASE_URL}/apps/${config.privy.appId}/.well-known/jwks.json`);
  if (!res.ok) {
    throw new Error(`Privy JWKS fetch failed with status ${res.status}`);
  }

  cachedJwks = (await res.json()) as JwksResponse;
  jwksFetchedAt = now;
  return cachedJwks;
};

const verifyPrivyAccessToken = async (token: string): Promise<string | null> => {
  const headerSegment = token.split('.')[0];
  if (!headerSegment) {
    return null;
  }

  const header = JSON.parse(Buffer.from(headerSegment, 'base64url').toString('utf8')) as { kid?: string };
  const jwks = await fetchJwks();
  const jwk = jwks.keys.find((key) => key.kid === header.kid) ?? jwks.keys[0];
  if (!jwk) {
    return null;
  }

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['ES256'],
    issuer: 'privy.io',
    audience: config.privy.appId,
  }) as { sub?: string };

  return decoded.sub ?? null;
};

export const createPrivySolanaWalletForUser = async (opts: {
  externalUserId: string;
  email: string;
  name?: string;
}): Promise<PrivyWalletProvisionResult> => {
  if (!isPrivyConfigured()) {
    logger.warn({ userId: opts.externalUserId }, '[Privy] Skipping wallet provisioning — credentials not configured');
    return {};
  }

  try {
    const createUserRes = await fetch(`${PRIVY_BASE_URL}/users`, {
      method: 'POST',
      headers: privyHeaders(),
      body: JSON.stringify({
        external_id: opts.externalUserId,
        linked_accounts: [{ type: 'email', address: opts.email }],
        metadata: { name: opts.name ?? '' },
      }),
    });

    const userPayload = (await createUserRes.json().catch(() => ({}))) as PrivyUserResponse;
    if (!createUserRes.ok) {
      logger.error({ status: createUserRes.status, userId: opts.externalUserId }, '[Privy] User creation failed');
      return {};
    }

    const privyUserId = userPayload.id;
    if (!privyUserId) {
      logger.error({ userId: opts.externalUserId }, '[Privy] User id missing from create response');
      return {};
    }

    const createWalletRes = await fetch(`${PRIVY_BASE_URL}/users/${privyUserId}/wallets`, {
      method: 'POST',
      headers: privyHeaders(),
      body: JSON.stringify({
        chain_type: 'solana',
        wallet_type: 'embedded',
      }),
    });

    const walletPayload = (await createWalletRes.json().catch(() => ({}))) as PrivyUserResponse;
    if (!createWalletRes.ok) {
      logger.error({ status: createWalletRes.status, privyUserId }, '[Privy] Solana wallet creation failed');
      return { privyUserId };
    }

    const walletAddress = extractSolanaAddress(walletPayload) ?? extractSolanaAddress(userPayload);
    return {
      privyUserId,
      ...(walletAddress ? { walletAddress } : {}),
    };
  } catch (error) {
    logger.error({ error, userId: opts.externalUserId }, '[Privy] Wallet provisioning failed');
    return {};
  }
};

export const generatePrivyCustomToken = async (_userId: string): Promise<string | null> => {
  if (!isPrivyConfigured()) {
    return null;
  }
  // Privy does not expose a server endpoint to mint custom auth tokens.
  // JWT-based Privy auth uses tokens issued by this service via JWKS in the Privy Dashboard.
  return null;
};

export const validatePrivyToken = async (
  authHeader: string | null | undefined,
): Promise<PrivyValidatedSession | null> => {
  if (!authHeader?.startsWith('Bearer ') || !isPrivyConfigured()) {
    return null;
  }

  try {
    const token = authHeader.slice(7);
    const privyUserId = await verifyPrivyAccessToken(token);
    if (!privyUserId) {
      return null;
    }

    const profile = await fetchPrivyUserById(privyUserId);
    const walletAddress = extractSolanaAddress(profile) ?? '';
    const email = extractEmail(profile);

    return {
      privyUserId,
      walletAddress,
      ...(email ? { email } : {}),
    };
  } catch (error) {
    logger.warn({ error }, '[Privy] Token validation failed');
    return null;
  }
};

export const fetchPrivyUserById = async (privyUserId: string): Promise<PrivyUserResponse | null> => {
  if (!isPrivyConfigured()) {
    return null;
  }

  try {
    const res = await fetch(`${PRIVY_BASE_URL}/users/${privyUserId}`, {
      method: 'GET',
      headers: privyHeaders(),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as PrivyUserResponse;
  } catch (error) {
    logger.warn({ error, privyUserId }, '[Privy] Failed to fetch user profile');
    return null;
  }
};
