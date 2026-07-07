import { Request, Response, NextFunction } from 'express';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { verifyOtp } from '../otp';
import { MESSAGES } from '@core/constants/messages';
import { loginByUserId } from '../login';
import { resumeOnboardingByEmail } from '@core/services/onboardingSession';
import { patchOnboardingState } from '@core/services/cache/onboarding';
import { purgeLegacyIncompleteMongoUser } from '@api/USERS/services/onboarding/deleteIncompleteUser';
import { findUserByEmail } from '@core/services/db/userLookup';

export const verify2fa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp, rememberMe } = req.body as { email: string; otp: string; rememberMe: boolean };
    if (!email || !otp) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Email and OTP are required.');
    }

    await verifyOtp(email, 'login_2fa', otp);
    await purgeLegacyIncompleteMongoUser(email);

    const completeUser = await findUserByEmail(email, { onboardingComplete: true });
    if (completeUser) {
      const tokens = await loginByUserId(String(completeUser._id), rememberMe);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: MESSAGES.AUTH.LOGIN_SUCCESS,
        data: tokens,
      });
      return;
    }

    const onboarding = await resumeOnboardingByEmail(email);
    if (!onboarding) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
    }

    await patchOnboardingState(onboarding.onboardingToken, { rememberMe });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Verification successful. Complete onboarding to continue.',
      data: {
        requiresOnboarding: true,
        onboardingToken: onboarding.onboardingToken,
        currentStep: onboarding.currentStep,
        userType: onboarding.userType,
      },
    });
  } catch (err) {
    next(err);
  }
};

