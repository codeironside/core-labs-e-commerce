import { Request, Response, NextFunction } from 'express';
import {
  OnboardingBasicStepSchema,
  OnboardingVendorBankStepSchema,
  OnboardingVendorProfileStepSchema,
} from '@api/USERS/schemas/onboarding';
import { getOnboardingState, saveOnboardingDraft } from '@core/services/cache/onboarding';
import { ONBOARDING_STEPS, ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { findUserOne } from '@core/services/db/userLookup';
import { MESSAGES } from '@core/constants/messages';
import { getNextStepForUserType } from '../validateStep';
import { resolveVendorBankDetails } from '../resolveBankDetails';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { handleVendorWizardStep } from '../vendorStepHandlers';

const vendorWizardSteps = new Set<string>([
  ONBOARDING_STEPS.GUIDELINES,
  ONBOARDING_STEPS.CATEGORIES,
  ONBOARDING_STEPS.SUBCATEGORIES,
  ONBOARDING_STEPS.EXPERIENCE,
  ONBOARDING_STEPS.SOCIAL,
  ONBOARDING_STEPS.ADDRESS,
  ONBOARDING_STEPS.PAYOUT,
  ONBOARDING_STEPS.PAYOUT_DETAILS,
  ONBOARDING_STEPS.IDENTITY,
]);

export const saveOnboardingStep = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const step = req.params.step as string;

    if (vendorWizardSteps.has(step)) {
      const result = await handleVendorWizardStep(step, req.body);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Onboarding step saved.',
        data: result,
      });
      return;
    }

    if (step === ONBOARDING_STEPS.BASIC) {
      const payload = OnboardingBasicStepSchema.parse(req.body);
      const state = await getOnboardingState(payload.onboardingToken);
      if (!state) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired onboarding session.');
      }

      if (state.requiresPhoneNumber && !payload.phoneNumber) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'phoneNumber is required for social accounts.');
      }

      if (payload.username) {
        const taken = await findUserOne({ username: payload.username });
        if (taken) {
          throw new AppError(HTTP_STATUS.CONFLICT, 'Username is already taken.');
        }
      }

      if (
        payload.userType === ONBOARDING_USER_TYPES.VENDOR &&
        state.account.signupRole !== 'vendor'
      ) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          'Vendor accounts must be created through seller signup.',
        );
      }

      if (
        state.draft.userType &&
        payload.userType !== state.draft.userType &&
        state.account.signupRole !== 'vendor'
      ) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Onboarding user type cannot be changed.');
      }

      const nextStep = getNextStepForUserType(payload.userType, ONBOARDING_STEPS.BASIC, state.role);
      const updated = await saveOnboardingDraft(
        payload.onboardingToken,
        {
          username: payload.username,
          phoneNumber: payload.phoneNumber,
          userType: payload.userType,
          ...(payload.categories ? { categories: payload.categories } : {}),
          ...(payload.subcategories ? { subcategories: payload.subcategories } : {}),
        },
        nextStep,
      );

      await publishKafkaEvent(
        KAFKA_TOPICS.ONBOARDING_STEP_SAVED,
        { userId: state.userId, step: ONBOARDING_STEPS.BASIC, userType: payload.userType },
        state.userId,
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Onboarding step saved.',
        data: { currentStep: updated.currentStep, draft: updated.draft },
      });
      return;
    }

    if (step === ONBOARDING_STEPS.VENDOR_PROFILE) {
      const payload = OnboardingVendorProfileStepSchema.parse(req.body);
      const state = await getOnboardingState(payload.onboardingToken);
      if (!state) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired onboarding session.');
      }

      const updated = await saveOnboardingDraft(
        payload.onboardingToken,
        {
          categories: payload.categories,
          subcategories: payload.subcategories,
          businessStatus: payload.businessStatus,
          address: payload.address,
          cacNumber: payload.cacNumber,
        },
        ONBOARDING_STEPS.VENDOR_BANK,
      );

      await publishKafkaEvent(
        KAFKA_TOPICS.ONBOARDING_STEP_SAVED,
        { userId: state.userId, step: ONBOARDING_STEPS.VENDOR_PROFILE },
        state.userId,
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Vendor profile step saved.',
        data: { currentStep: updated.currentStep, draft: updated.draft },
      });
      return;
    }

    if (step === ONBOARDING_STEPS.VENDOR_BANK) {
      const payload = OnboardingVendorBankStepSchema.parse(req.body);
      const state = await getOnboardingState(payload.onboardingToken);
      if (!state) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired onboarding session.');
      }

      const resolvedBank = await resolveVendorBankDetails(
        payload.bankDetails,
        state.draft.addressDetails?.fullName?.trim() || state.account.name,
      );
      const updated = await saveOnboardingDraft(
        payload.onboardingToken,
        { bankDetails: resolvedBank, payoutMethod: 'bank' },
        ONBOARDING_STEPS.COMPLETE,
      );

      await publishKafkaEvent(
        KAFKA_TOPICS.ONBOARDING_STEP_SAVED,
        { userId: state.userId, step: ONBOARDING_STEPS.VENDOR_BANK },
        state.userId,
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Bank details verified and saved.',
        data: { currentStep: updated.currentStep, draft: updated.draft },
      });
      return;
    }

    throw new AppError(HTTP_STATUS.BAD_REQUEST, MESSAGES.GENERAL.VALIDATION_ERROR);
  } catch (error) {
    next(error);
  }
};
