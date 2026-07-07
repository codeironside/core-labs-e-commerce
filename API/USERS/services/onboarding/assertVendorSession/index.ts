import { ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
import type { OnboardingState } from '@api/USERS/interfaces/onboarding';

export const assertVendorOnboardingSession = (state: OnboardingState): void => {
  if (state.account.signupRole !== 'vendor') {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      'Vendor onboarding steps are only available for seller signups.',
    );
  }

  if (
    state.draft.userType &&
    state.draft.userType !== ONBOARDING_USER_TYPES.VENDOR
  ) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      'This onboarding session is not configured for vendor registration.',
    );
  }
};
