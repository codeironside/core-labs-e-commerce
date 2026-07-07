import axios from 'axios';
import { config } from '../../config/index.js';

export interface OAuthUserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: 'google' | 'github';
}

export interface OAuthProvider {
  getAuthUrl(state?: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string }>;
  getUserProfile(accessToken: string): Promise<OAuthUserProfile>;
}

class GoogleOAuthProvider implements OAuthProvider {
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });
    if (state) {
      params.set('state', state);
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string }> {
    const { data } = await axios.post<{ access_token: string }>('https://oauth2.googleapis.com/token', {
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: 'authorization_code',
    });
    return { accessToken: data.access_token };
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const { data } = await axios.get<{ sub: string; email: string; name: string; picture?: string }>(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return {
      id: data.sub,
      email: data.email,
      name: data.name,
      avatarUrl: data.picture,
      provider: 'google',
    };
  }
}

class GitHubOAuthProvider implements OAuthProvider {
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.redirectUri,
      scope: 'read:user user:email',
    });
    if (state) {
      params.set('state', state);
    }
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string }> {
    const { data } = await axios.post<{ access_token: string }>(
      'https://github.com/login/oauth/access_token',
      {
        code,
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        redirect_uri: config.github.redirectUri,
      },
      { headers: { Accept: 'application/json' } },
    );
    return { accessToken: data.access_token };
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const [{ data: user }, { data: emails }] = await Promise.all([
      axios.get<{ id: number; email: string; name: string; avatar_url?: string }>(
        'https://api.github.com/user',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
      axios.get<Array<{ email: string; primary: boolean }>>('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);
    const primary = emails.find((entry) => entry.primary);
    return {
      id: String(user.id),
      email: primary?.email ?? user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
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
