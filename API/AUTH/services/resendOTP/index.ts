import { Request, Response, NextFunction } from 'express';
import { ResendOtpSchema } from '@api/AUTH/schemas';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { createAndSendOtp } from '../otp';
import { getPendingSignup } from '@core/services/cache/pendingSignup';
import { getOnboardingSessionByEmail } from '@core/services/cache/onboarding';
import { findUserByEmail } from '@core/services/db/userLookup';

export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, purpose } = ResendOtpSchema.parse(req.body);
    const pending = await getPendingSignup(email);
    const onboardingSession = await getOnboardingSessionByEmail(email);
    const user = await findUserByEmail(email);

    if (!pending && !user && !onboardingSession) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
    }

    if (purpose === 'email_verification' && !pending && user?.onboardingComplete) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Email is already verified.');
    }

    if (purpose === 'login_2fa' && !user?.onboardingComplete && !onboardingSession) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, MESSAGES.AUTH.VERIFY_EMAIL_FIRST);
    }

    await createAndSendOtp(email, purpose, { enforceCooldown: true });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.AUTH.OTP_RESENT,
    });
  } catch (err) {
    next(err);
  }
};
