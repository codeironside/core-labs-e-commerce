import { Request, Response, NextFunction } from 'express';
import { VerifyEmailSchema } from '@api/AUTH/schemas';
import { verifyOtp } from '../otp';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { loginByUserId } from '../login';
import {
  buildCredentialAccount,
  resolveOnboardingSession,
  resumeOnboardingByEmail,
} from '@core/services/onboardingSession';
import {
  clearPendingSignup,
  getPendingSignup,
} from '@core/services/cache/pendingSignup';
import { purgeLegacyIncompleteMongoUser } from '@api/USERS/services/onboarding/deleteIncompleteUser';
import { findUserByEmail } from '@core/services/db/userLookup';

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp, rememberMe } = VerifyEmailSchema.parse(req.body);
    await verifyOtp(email, 'email_verification', otp);
    await purgeLegacyIncompleteMongoUser(email);

    const pending = await getPendingSignup(email);
    if (pending) {
      const account = buildCredentialAccount({
        name: pending.name,
        email: pending.email,
        passwordHash: pending.passwordHash,
        workspaceRole: pending.workspaceRole,
        signupRole: pending.signupRole,
      });

      const onboarding = await resolveOnboardingSession({
        account,
        rememberMe: rememberMe ?? pending.rememberMe,
        signupRole: pending.signupRole,
      });
      await clearPendingSignup(email);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: MESSAGES.AUTH.EMAIL_VERIFIED,
        data: {
          requiresOnboarding: true,
          onboardingToken: onboarding.onboardingToken,
          currentStep: onboarding.currentStep,
          userType: onboarding.userType,
        },
      });
      return;
    }

    const existingOnboarding = await resumeOnboardingByEmail(email);
    if (existingOnboarding) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: MESSAGES.AUTH.EMAIL_VERIFIED,
        data: {
          requiresOnboarding: true,
          onboardingToken: existingOnboarding.onboardingToken,
          currentStep: existingOnboarding.currentStep,
          userType: existingOnboarding.userType,
        },
      });
      return;
    }

    const user = await findUserByEmail(email, { onboardingComplete: true });
    if (!user) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
    }

    const tokens = await loginByUserId(String(user._id), rememberMe ?? false);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.AUTH.EMAIL_VERIFIED,
      data: tokens,
    });
  } catch (err) {
    next(err);
  }
};

