import axios from 'axios';
import { config } from '@core/config';
class GoogleOAuthProvider {
    getAuthUrl() {
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
    async exchangeCode(code) {
        const { data } = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: config.google.clientId,
            client_secret: config.google.clientSecret,
            redirect_uri: config.google.redirectUri,
            grant_type: 'authorization_code',
        });
        return { accessToken: data.access_token };
    }
    async getUserProfile(accessToken) {
        const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return {
            id: data.sub,
            email: data.email,
            name: data.name,
            avatarUrl: data.picture,
            provider: 'google',
        };
    }
}
class GitHubOAuthProvider {
    getAuthUrl() {
        const params = new URLSearchParams({
            client_id: config.github.clientId,
            redirect_uri: config.github.redirectUri,
            scope: 'read:user user:email',
        });
        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }
    async exchangeCode(code) {
        const { data } = await axios.post('https://github.com/login/oauth/access_token', { code, client_id: config.github.clientId, client_secret: config.github.clientSecret, redirect_uri: config.github.redirectUri }, { headers: { Accept: 'application/json' } });
        return { accessToken: data.access_token };
    }
    async getUserProfile(accessToken) {
        const [{ data: user }, { data: emails }] = await Promise.all([
            axios.get('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}` } }),
            axios.get('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);
        const primary = emails.find((e) => e.primary);
        return {
            id: String(user.id),
            email: primary?.email ?? user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            provider: 'github',
        };
    }
}
const providers = {
    google: new GoogleOAuthProvider(),
    github: new GitHubOAuthProvider(),
};
export function getOAuthProvider(name) {
    return providers[name];
}
