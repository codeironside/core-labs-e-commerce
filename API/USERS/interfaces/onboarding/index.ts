import type { OnboardingStep, OnboardingUserType } from '@core/constants/onboarding';
import type { SignupRole } from '@api/AUTH/schemas';
import type { UserRole } from '@api/AUTH/models/user';

export type OnboardingAuthMethod = 'credential' | 'google' | 'github' | 'privy';

export interface OnboardingAccountRecord {
  provisionalUserId: string;
  name: string;
  email: string;
  workspaceRole: UserRole;
  signupRole: SignupRole;
  authMethod: OnboardingAuthMethod;
  passwordHash?: string;
  oauthProvider?: 'google' | 'github' | 'privy' | 'facebook';
  oauthProviderId?: string;
  privyUserId?: string;
  profileImage?: string;
  avatarUrl?: string;
  solanaUsdcWalletAddress?: string;
}

export type IdentityDocumentType =
  | 'international_passport'
  | 'drivers_license'
  | 'nin'
  | 'statement_of_account'
  | 'utility_bill';

export type PayoutMethod = 'bank' | 'usdc';

export interface OnboardingBankDraft {
  bankCode: string;
  accountNumber: string;
  accountName?: string;
  bankName?: string;
}

export interface OnboardingAddressDraft {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OnboardingIdentityDraft {
  documentType: IdentityDocumentType;
  nin?: string;
  documentFileName?: string;
  documentUrl?: string;
  ninVerified?: boolean;
  verifiedFirstName?: string;
  verifiedLastName?: string;
}

export interface OnboardingDraft {
  username?: string;
  phoneNumber?: string;
  userType?: OnboardingUserType;
  agreedToGuidelines?: boolean;
  phoneConsent?: boolean;
  categories?: string[];
  subcategories?: string[];
  businessStatus?: 'registered' | 'unregistered';
  sellingExperience?: 'starting' | 'active';
  socialChannels?: string[];
  address?: string;
  addressDetails?: OnboardingAddressDraft;
  cacNumber?: string;
  payoutMethod?: PayoutMethod;
  bankDetails?: OnboardingBankDraft;
  cryptoWalletAddress?: string;
  makeDefaultPayout?: boolean;
  identityVerification?: OnboardingIdentityDraft;
  identitySkipped?: boolean;
  identityVerificationStatus?: 'pending' | 'verified' | 'skipped' | 'admin_bypass';
  canGoLive?: boolean;
  tutorialCompleted?: boolean;
}

export interface OnboardingState {
  userId: string;
  identifier: string;
  role: string;
  requiresPhoneNumber: boolean;
  rememberMe: boolean;
  currentStep: OnboardingStep;
  draft: OnboardingDraft;
  account: OnboardingAccountRecord;
  createdAt: string;
}

export interface OnboardingSessionMeta {
  onboardingToken: string;
  currentStep: OnboardingStep;
  userType?: OnboardingUserType;
  requiresOnboarding: true;
}
