export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSessionResponse extends TokenPair {
  userId: string;
  privyUserId?: string;
  solanaUsdcWalletAddress?: string;
  privyToken?: string | null;
}

export interface PrivyLoginPayload {
  privyAccessToken?: string;
  rememberMe?: boolean;
}
