import axios from 'axios';
import { config } from '@core/config';

export interface OAuthProvider {
  getAuthUrl(): string;
  exchangeCode(code: string): Promise<{ accessToken: string }>;
  getUserProfile(accessToken: string): Promise<OAuthUserProfile>;
}

export interface OAuthUserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: 'google' | 'github';
}

class GoogleOAuthProvider implements OAuthProvider {
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string }> {
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: 'authorization_code',
    });
    return { accessToken: data.access_token as string };
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      id: data.sub as string,
      email: data.email as string,
      name: data.name as string,
      avatarUrl: data.picture as string | undefined,
      provider: 'google',
    };
  }
}

class GitHubOAuthProvider implements OAuthProvider {
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.redirectUri,
      scope: 'read:user user:email',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string }> {
    const { data } = await axios.post(
      'https://github.com/login/oauth/access_token',
      { code, client_id: config.github.clientId, client_secret: config.github.clientSecret, redirect_uri: config.github.redirectUri },
      { headers: { Accept: 'application/json' } },
    );
    return { accessToken: data.access_token as string };
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const [{ data: user }, { data: emails }] = await Promise.all([
      axios.get('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}` } }),
      axios.get('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    const primary = (emails as Array<{ email: string; primary: boolean }>).find((e) => e.primary);
    return {
      id: String(user.id),
      email: primary?.email ?? (user.email as string),
      name: user.name as string,
      avatarUrl: user.avatar_url as string | undefined,
      provider: 'github',
    };
  }
}

const providers: Record<'google' | 'github', OAuthProvider> = {
  google: new GoogleOAuthProvider(),
  github: new GitHubOAuthProvider(),
};

export function getOAuthProvider(name: 'google' | 'github'): OAuthProvider {
  return providers[name];
}
