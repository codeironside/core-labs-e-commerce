import {
  OnboardingAddressStepSchema,
  OnboardingCategoriesStepSchema,
  OnboardingExperienceStepSchema,
  OnboardingGuidelinesStepSchema,
  OnboardingIdentityStepSchema,
  OnboardingPayoutDetailsStepSchema,
  OnboardingPayoutStepSchema,
  OnboardingSocialStepSchema,
  OnboardingSubcategoriesStepSchema,
} from '@api/USERS/schemas/onboarding';
import { getOnboardingState, saveOnboardingDraft } from '@core/services/cache/onboarding';
import { ONBOARDING_STEPS, getVendorNextStep } from '@core/constants/onboarding';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { resolveVendorBankDetails, buildDevBypassBankDetails } from '../resolveBankDetails';
import { verifyNinWithPrembly } from '@core/services/prembly';
import { assertVendorOnboardingSession } from '../assertVendorSession';
import type { OnboardingDraft } from '@api/USERS/interfaces/onboarding';
import { config } from '@core/config';

const namesMatchRegisteredAccount = (
  registeredName: string,
  firstName: string,
  lastName: string,
): boolean => {
  const holder = registeredName.toLowerCase();
  const nameParts = [firstName, lastName]
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 2);
  return nameParts.length > 0 && nameParts.every((part) => holder.includes(part));
};

const publishStepSaved = async (userId: string, step: string): Promise<void> => {
  await publishKafkaEvent(KAFKA_TOPICS.ONBOARDING_STEP_SAVED, { userId, step }, userId);
};

const requireState = async (token: string) => {
  const state = await getOnboardingState(token);
  if (!state) {
    throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired onboarding session.');
  }
  assertVendorOnboardingSession(state);
  return state;
};

const saveVendorPatch = async (
  token: string,
  patch: OnboardingDraft,
  currentStep: (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS],
) => {
  const nextStep = getVendorNextStep(currentStep);
  return saveOnboardingDraft(token, patch, nextStep);
};

export const handleVendorWizardStep = async (
  step: string,
  body: unknown,
): Promise<{ currentStep: string; draft: OnboardingDraft }> => {
  if (step === ONBOARDING_STEPS.GUIDELINES) {
    const payload = OnboardingGuidelinesStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);
    if (state.requiresPhoneNumber && !payload.phoneNumber?.trim()) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'Phone number is required for accounts signed up with Google or social login.',
      );
    }
    const updated = await saveVendorPatch(
      payload.onboardingToken,
      {
        agreedToGuidelines: true,
        phoneConsent: payload.phoneConsent,
        ...(payload.phoneNumber?.trim() ? { phoneNumber: payload.phoneNumber.trim() } : {}),
        userType: 'vendor',
      },
      ONBOARDING_STEPS.GUIDELINES,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  if (step === ONBOARDING_STEPS.CATEGORIES) {
    const payload = OnboardingCategoriesStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);
    const updated = await saveVendorPatch(
      payload.onboardingToken,
      { categories: payload.categories, userType: 'vendor' },
      ONBOARDING_STEPS.CATEGORIES,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  if (step === ONBOARDING_STEPS.SUBCATEGORIES) {
    const payload = OnboardingSubcategoriesStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);
    const updated = await saveVendorPatch(
      payload.onboardingToken,
      { subcategories: payload.subcategories },
      ONBOARDING_STEPS.SUBCATEGORIES,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  if (step === ONBOARDING_STEPS.EXPERIENCE) {
    const payload = OnboardingExperienceStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);
    const updated = await saveVendorPatch(
      payload.onboardingToken,
      {
        sellingExperience: payload.sellingExperience,
        businessStatus: payload.businessStatus,
      },
      ONBOARDING_STEPS.EXPERIENCE,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  if (step === ONBOARDING_STEPS.SOCIAL) {
    const payload = OnboardingSocialStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);
    const updated = await saveVendorPatch(
      payload.onboardingToken,
      { socialChannels: payload.socialChannels },
      ONBOARDING_STEPS.SOCIAL,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  if (step === ONBOARDING_STEPS.ADDRESS) {
    const payload = OnboardingAddressStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);
    if (state.requiresPhoneNumber && !state.draft.phoneNumber && !payload.phoneNumber?.trim()) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        'Phone number is required for accounts signed up with Google or social login.',
      );
    }
    const formatted = [
      payload.addressDetails.line1,
      payload.addressDetails.line2,
      payload.addressDetails.city,
      payload.addressDetails.state,
      payload.addressDetails.postalCode,
      payload.addressDetails.country,
    ]
      .filter(Boolean)
      .join(', ');
    const updated = await saveVendorPatch(
      payload.onboardingToken,
      {
        addressDetails: payload.addressDetails,
        address: formatted,
        ...(payload.phoneNumber?.trim() ? { phoneNumber: payload.phoneNumber.trim() } : {}),
      },
      ONBOARDING_STEPS.ADDRESS,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  if (step === ONBOARDING_STEPS.PAYOUT) {
    const payload = OnboardingPayoutStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);
    const updated = await saveVendorPatch(
      payload.onboardingToken,
      {
        payoutMethod: payload.payoutMethod,
        makeDefaultPayout: payload.makeDefaultPayout,
      },
      ONBOARDING_STEPS.PAYOUT,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  if (step === ONBOARDING_STEPS.PAYOUT_DETAILS) {
    const payload = OnboardingPayoutDetailsStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);
    const payoutMethod = state.draft.payoutMethod;

    if (payoutMethod === 'bank') {
      if (!payload.bankDetails) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'bankDetails are required for bank payout.');
      }
      const bankDetails = payload.bankDetails;
      const accountHolderName =
        state.draft.addressDetails?.fullName?.trim() || state.account.name;

      const resolvedBank = payload.devBypassPaystackVerify
        ? await (async () => {
            if (config.env !== 'development') {
              throw new AppError(HTTP_STATUS.FORBIDDEN, 'Paystack dev bypass is not available.');
            }
            return buildDevBypassBankDetails(bankDetails, accountHolderName);
          })()
        : await resolveVendorBankDetails(bankDetails, accountHolderName);

      const updated = await saveVendorPatch(
        payload.onboardingToken,
        { bankDetails: resolvedBank },
        ONBOARDING_STEPS.PAYOUT_DETAILS,
      );
      await publishStepSaved(state.userId, step);
      return { currentStep: updated.currentStep, draft: updated.draft };
    }

    if (!payload.cryptoWalletAddress) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'cryptoWalletAddress is required for USDC payout.');
    }
    const updated = await saveVendorPatch(
      payload.onboardingToken,
      { cryptoWalletAddress: payload.cryptoWalletAddress },
      ONBOARDING_STEPS.PAYOUT_DETAILS,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  if (step === ONBOARDING_STEPS.IDENTITY) {
    const payload = OnboardingIdentityStepSchema.parse(body);
    const state = await requireState(payload.onboardingToken);

    if (payload.skipIdentity) {
      const updated = await saveVendorPatch(
        payload.onboardingToken,
        { identitySkipped: true, identityVerificationStatus: 'skipped' },
        ONBOARDING_STEPS.IDENTITY,
      );
      await publishStepSaved(state.userId, step);
      return { currentStep: updated.currentStep, draft: updated.draft };
    }

    const identity = payload.identityVerification;
    if (!identity) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Identity verification payload is required.');
    }

    if (identity.documentType === 'nin') {
      if (!identity.nin) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'NIN is required for NIN verification.');
      }

      const ninResult = await verifyNinWithPrembly(identity.nin);
      if (!namesMatchRegisteredAccount(state.account.name, ninResult.firstName, ninResult.lastName)) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          'NIN identity does not match your registered account name.',
        );
      }

      const updated = await saveVendorPatch(
        payload.onboardingToken,
        {
          identityVerification: {
            ...identity,
            ninVerified: true,
            verifiedFirstName: ninResult.firstName,
            verifiedLastName: ninResult.lastName,
          },
          identitySkipped: false,
          identityVerificationStatus: 'verified',
          canGoLive: true,
        },
        ONBOARDING_STEPS.IDENTITY,
      );
      await publishStepSaved(state.userId, step);
      return { currentStep: updated.currentStep, draft: updated.draft };
    }

    const updated = await saveVendorPatch(
      payload.onboardingToken,
      {
        identityVerification: identity,
        identitySkipped: false,
        identityVerificationStatus: 'pending',
        canGoLive: false,
      },
      ONBOARDING_STEPS.IDENTITY,
    );
    await publishStepSaved(state.userId, step);
    return { currentStep: updated.currentStep, draft: updated.draft };
  }

  throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Unsupported onboarding step.');
};
