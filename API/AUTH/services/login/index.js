import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@core/config';
import { MESSAGES } from '@core/constants/messages';
import { HTTP_STATUS } from '@core/constants';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { AppError } from '@core/middleware/errorHandler';
import { getRedisClient } from '@core/services/redis';
import { publishKafkaEvent } from '@core/services/kafka';
import { generatePrivyCustomToken } from '@core/services/privy';
import { AccountModel } from '@api/AUTH/models';
import { resolveOnboardingSession } from '@core/services/onboardingSession';
import { createOAuthPendingSession } from '@core/services/oauth/oauthPending';
import { purgeLegacyIncompleteMongoUser } from '@api/USERS/services/onboarding/deleteIncompleteUser';
import { getPublicPlatformSignupSettings } from '@api/ADMIN/services/platform_settings';
import { findUserById, findUserOne } from '@core/services/db/userLookup';
import { assertUserNotPlatformBanned } from '@api/AUTH/services/assertNotBanned';
function generateAccessToken(payload) {
    return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl });
}
function generateRefreshToken() {
    return uuidv4();
}
async function storeRefreshToken(userId, token, ttl) {
    await getRedisClient().setex(`refresh:${token}`, ttl, userId);
}
function issueTokenPair(user, rememberMe = false) {
    const accessToken = generateAccessToken({
        userId: String(user._id),
        workspaceId: String(user.workspaceId),
        role: user.role,
        ...(user.userType ? { userType: user.userType } : {}),
        rememberMe,
    });
    const refreshToken = generateRefreshToken();
    return { accessToken, refreshToken };
}
async function buildAuthSession(user, rememberMe = false) {
    const tokens = issueTokenPair(user, rememberMe);
    const ttl = rememberMe ? config.jwt.rememberMeTtl : config.jwt.refreshTtl;
    await storeRefreshToken(String(user._id), tokens.refreshToken, ttl);
    const privyToken = await generatePrivyCustomToken(String(user._id));
    return {
        ...tokens,
        userId: String(user._id),
        ...(user.privyUserId ? { privyUserId: user.privyUserId } : {}),
        ...(user.solanaUsdcWalletAddress ? { solanaUsdcWalletAddress: user.solanaUsdcWalletAddress } : {}),
        privyToken,
    };
}
const resolveWorkspaceRole = (signupRole) => {
    if (signupRole === 'vendor') {
        return 'member';
    }
    if (signupRole === 'admin' || signupRole === 'super_admin') {
        return signupRole;
    }
    return signupRole;
};
export const assertSignupRoleAllowed = async (signupRole) => {
    const workspaceRole = resolveWorkspaceRole(signupRole);
    const settings = await getPublicPlatformSignupSettings();
    if (workspaceRole === 'editor' && !settings.allowContentEditorSignup) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Content editor signup is currently disabled.');
    }
    if (workspaceRole === 'admin' && !settings.allowAdminSignup) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Admin signup is currently disabled.');
    }
    if (workspaceRole === 'super_admin' && !settings.allowSuperAdminSignup) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Super admin signup is currently disabled.');
    }
    return workspaceRole;
};
export async function loginOAuthUser(profile, options = { intent: 'login' }) {
    await purgeLegacyIncompleteMongoUser(profile.email);
    const completeUser = await findUserOne({
        $or: [
            { oauthProvider: profile.provider, oauthProviderId: profile.id, onboardingComplete: true },
            { email: profile.email.toLowerCase(), onboardingComplete: true },
        ],
    });
    if (completeUser) {
        assertUserNotPlatformBanned(completeUser);
        completeUser.oauthProvider = profile.provider;
        completeUser.oauthProviderId = profile.id;
        if (profile.avatarUrl) {
            completeUser.profileImage = profile.avatarUrl;
            completeUser.avatarUrl = profile.avatarUrl;
        }
        await completeUser.save();
        await AccountModel.findOneAndUpdate({ providerId: profile.provider, accountId: profile.id }, {
            userId: completeUser._id,
            providerId: profile.provider,
            accountId: profile.id,
        }, { upsert: true, new: true });
        const tokens = issueTokenPair(completeUser);
        await storeRefreshToken(String(completeUser._id), tokens.refreshToken, config.jwt.refreshTtl);
        await publishKafkaEvent(KAFKA_TOPICS.USER_LOGIN, {
            userId: String(completeUser._id),
            method: `oauth:${profile.provider}`,
        }, String(completeUser._id));
        return {
            userId: String(completeUser._id),
            tokens,
            onboardingComplete: true,
        };
    }
    if (options.intent === 'login' || !options.signupRole) {
        const oauthPendingToken = await createOAuthPendingSession(profile);
        return {
            onboardingComplete: false,
            requiresSignupRole: true,
            oauthPendingToken,
        };
    }
    const signupRole = options.signupRole;
    const workspaceRole = await assertSignupRoleAllowed(signupRole);
    const onboardingSession = await resolveOnboardingSession({
        account: {
            provisionalUserId: crypto.randomUUID(),
            name: profile.name,
            email: profile.email.toLowerCase(),
            workspaceRole,
            signupRole,
            authMethod: profile.provider,
            oauthProvider: profile.provider,
            oauthProviderId: profile.id,
            profileImage: profile.avatarUrl,
            avatarUrl: profile.avatarUrl,
        },
        signupRole,
        requiresPhoneNumber: true,
    });
    return {
        onboardingComplete: false,
        onboardingSession,
    };
}
export async function loginPrivyUser(session, signupRole = 'member') {
    const email = session.email?.toLowerCase() ?? `privy+${session.privyUserId}@users.corelabs.local`;
    if (session.email) {
        await purgeLegacyIncompleteMongoUser(session.email);
    }
    const completeUser = await findUserOne({
        $or: [
            { privyUserId: session.privyUserId, onboardingComplete: true },
            ...(session.email ? [{ email, onboardingComplete: true }] : []),
        ],
    });
    if (completeUser) {
        assertUserNotPlatformBanned(completeUser);
        completeUser.privyUserId = session.privyUserId;
        completeUser.oauthProvider = 'privy';
        completeUser.oauthProviderId = session.privyUserId;
        if (session.walletAddress) {
            completeUser.solanaUsdcWalletAddress = session.walletAddress;
        }
        await completeUser.save();
        await AccountModel.findOneAndUpdate({ providerId: 'privy', accountId: session.privyUserId }, {
            userId: completeUser._id,
            providerId: 'privy',
            accountId: session.privyUserId,
        }, { upsert: true, new: true });
        const authResponse = await buildAuthSession(completeUser);
        await publishKafkaEvent(KAFKA_TOPICS.USER_LOGIN, {
            userId: String(completeUser._id),
            method: 'privy',
        }, String(completeUser._id));
        return {
            userId: String(completeUser._id),
            authResponse,
            onboardingComplete: true,
        };
    }
    const workspaceRole = resolveWorkspaceRole(signupRole);
    const onboardingSession = await resolveOnboardingSession({
        account: {
            provisionalUserId: crypto.randomUUID(),
            name: session.email?.split('@')[0] ?? 'Privy User',
            email,
            workspaceRole,
            signupRole,
            authMethod: 'privy',
            oauthProvider: 'privy',
            oauthProviderId: session.privyUserId,
            privyUserId: session.privyUserId,
            ...(session.walletAddress ? { solanaUsdcWalletAddress: session.walletAddress } : {}),
        },
        signupRole,
        requiresPhoneNumber: !session.email,
    });
    return {
        onboardingComplete: false,
        onboardingSession,
    };
}
export async function refreshTokens(payload) {
    const redis = getRedisClient();
    const userId = await redis.get(`refresh:${payload.refreshToken}`);
    if (!userId) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_INVALID);
    }
    await redis.del(`refresh:${payload.refreshToken}`);
    const user = await findUserById(userId);
    if (!user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_INVALID);
    }
    const tokens = issueTokenPair(user);
    await storeRefreshToken(userId, tokens.refreshToken, config.jwt.refreshTtl);
    await publishKafkaEvent(KAFKA_TOPICS.USER_REFRESHED, { userId }, userId);
    return tokens;
}
export async function logoutUser(refreshToken) {
    const redis = getRedisClient();
    const userId = await redis.get(`refresh:${refreshToken}`);
    await redis.del(`refresh:${refreshToken}`);
    if (userId) {
        await publishKafkaEvent(KAFKA_TOPICS.USER_LOGOUT, { userId }, userId);
    }
    return userId;
}
export async function loginByUserId(userId, rememberMe = false) {
    const user = await findUserById(userId);
    if (!user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
    assertUserNotPlatformBanned(user);
    const authResponse = await buildAuthSession(user, rememberMe);
    await publishKafkaEvent(KAFKA_TOPICS.USER_LOGIN, {
        userId,
        method: rememberMe ? 'password:remember-me' : 'password',
    }, userId);
    return authResponse;
}
