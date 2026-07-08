import crypto from 'node:crypto';
import { getOnboardingSessionByEmail, getOnboardingState, getPendingOnboardingToken, setOnboardingState, } from '@core/services/cache/onboarding';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { ONBOARDING_STEPS, ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
const isPrivilegedRole = (role) => role === 'admin' || role === 'super_admin';
const mapRoleToDefaultUserType = (role) => {
    if (role === 'editor' || isPrivilegedRole(role)) {
        return ONBOARDING_USER_TYPES.EDITOR;
    }
    return ONBOARDING_USER_TYPES.BUYER;
};
const toSessionMeta = (onboardingToken, state, defaultUserType) => ({
    onboardingToken,
    currentStep: state?.currentStep ?? ONBOARDING_STEPS.BASIC,
    userType: state?.draft.userType ?? defaultUserType,
    requiresOnboarding: true,
});
export const resolveOnboardingSession = async (input) => {
    const defaultUserType = input.signupRole === 'vendor'
        ? ONBOARDING_USER_TYPES.VENDOR
        : mapRoleToDefaultUserType(input.account.workspaceRole);
    const existingByEmail = await getOnboardingSessionByEmail(input.account.email);
    if (existingByEmail) {
        return toSessionMeta(existingByEmail.token, existingByEmail.state, defaultUserType);
    }
    const existingToken = await getPendingOnboardingToken(input.account.provisionalUserId);
    if (existingToken) {
        const existingState = await getOnboardingState(existingToken);
        if (existingState) {
            return toSessionMeta(existingToken, existingState, defaultUserType);
        }
    }
    const onboardingToken = await setOnboardingState({
        account: input.account,
        requiresPhoneNumber: input.requiresPhoneNumber ?? false,
        rememberMe: input.rememberMe ?? false,
        defaultUserType,
    });
    await publishKafkaEvent(KAFKA_TOPICS.ONBOARDING_STARTED, {
        userId: input.account.provisionalUserId,
        role: input.account.workspaceRole,
        defaultUserType,
        email: input.account.email,
    }, input.account.provisionalUserId);
    return {
        onboardingToken,
        currentStep: defaultUserType === ONBOARDING_USER_TYPES.VENDOR
            ? ONBOARDING_STEPS.GUIDELINES
            : ONBOARDING_STEPS.BASIC,
        userType: defaultUserType,
        requiresOnboarding: true,
    };
};
export const resumeOnboardingByEmail = async (email) => {
    const session = await getOnboardingSessionByEmail(email);
    if (!session) {
        return null;
    }
    const defaultUserType = session.state.draft.userType ?? mapRoleToDefaultUserType(session.state.account.workspaceRole);
    return toSessionMeta(session.token, session.state, defaultUserType);
};
export const buildCredentialAccount = (input) => ({
    provisionalUserId: crypto.randomUUID(),
    name: input.name,
    email: input.email.trim().toLowerCase(),
    workspaceRole: input.workspaceRole,
    signupRole: input.signupRole,
    authMethod: 'credential',
    passwordHash: input.passwordHash,
});
