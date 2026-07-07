import crypto from 'node:crypto';
import {
  getOnboardingSessionByEmail,
  getOnboardingState,
  getPendingOnboardingToken,
  setOnboardingState,
} from '@core/services/cache/onboarding';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { ONBOARDING_STEPS, ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
import type {
  OnboardingAccountRecord,
  OnboardingSessionMeta,
} from '@api/USERS/interfaces/onboarding';
import type { SignupRole } from '@api/AUTH/schemas';
import type { UserRole } from '@api/AUTH/models/user';

const isPrivilegedRole = (role: UserRole): boolean => role === 'admin' || role === 'super_admin';

const mapRoleToDefaultUserType = (role: UserRole): 'vendor' | 'buyer' | 'editor' => {
  if (role === 'editor' || isPrivilegedRole(role)) {
    return ONBOARDING_USER_TYPES.EDITOR;
  }
  return ONBOARDING_USER_TYPES.BUYER;
};

const toSessionMeta = (
  onboardingToken: string,
  state: Awaited<ReturnType<typeof getOnboardingState>>,
  defaultUserType: 'vendor' | 'buyer' | 'editor',
): OnboardingSessionMeta => ({
  onboardingToken,
  currentStep: state?.currentStep ?? ONBOARDING_STEPS.BASIC,
  userType: state?.draft.userType ?? defaultUserType,
  requiresOnboarding: true,
});

export const resolveOnboardingSession = async (input: {
  account: OnboardingAccountRecord;
  rememberMe?: boolean;
  signupRole?: SignupRole;
  requiresPhoneNumber?: boolean;
}): Promise<OnboardingSessionMeta> => {
  const defaultUserType =
    input.signupRole === 'vendor'
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

  await publishKafkaEvent(
    KAFKA_TOPICS.ONBOARDING_STARTED,
    {
      userId: input.account.provisionalUserId,
      role: input.account.workspaceRole,
      defaultUserType,
      email: input.account.email,
    },
    input.account.provisionalUserId,
  );

  return {
    onboardingToken,
    currentStep: defaultUserType === ONBOARDING_USER_TYPES.VENDOR
      ? ONBOARDING_STEPS.GUIDELINES
      : ONBOARDING_STEPS.BASIC,
    userType: defaultUserType,
    requiresOnboarding: true,
  };
};

export const resumeOnboardingByEmail = async (email: string): Promise<OnboardingSessionMeta | null> => {
  const session = await getOnboardingSessionByEmail(email);
  if (!session) {
    return null;
  }

  const defaultUserType =
    session.state.draft.userType ?? mapRoleToDefaultUserType(session.state.account.workspaceRole);

  return toSessionMeta(session.token, session.state, defaultUserType);
};

export const buildCredentialAccount = (input: {
  name: string;
  email: string;
  passwordHash: string;
  workspaceRole: UserRole;
  signupRole: SignupRole;
}): OnboardingAccountRecord => ({
  provisionalUserId: crypto.randomUUID(),
  name: input.name,
  email: input.email.trim().toLowerCase(),
  workspaceRole: input.workspaceRole,
  signupRole: input.signupRole,
  authMethod: 'credential',
  passwordHash: input.passwordHash,
});
