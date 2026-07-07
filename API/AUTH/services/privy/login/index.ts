import { Request, Response, NextFunction } from 'express';
import { PrivyLoginSchema } from '@api/AUTH/schemas';
import { validatePrivyToken } from '@core/services/privy';
import { loginPrivyUser } from '../../login';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { AppError } from '@core/middleware/errorHandler';

export const privyLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = PrivyLoginSchema.safeParse(req.body);
    const headerToken = req.headers.authorization;
    const privyAccessToken = body.success ? body.data.privyAccessToken : undefined;
    const authHeader = privyAccessToken ? `Bearer ${privyAccessToken}` : headerToken;

    const session = await validatePrivyToken(authHeader);
    if (!session) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_INVALID);
    }

    const signupRole = body.success ? body.data.signupRole : undefined;
    const loginResult = await loginPrivyUser(session, signupRole ?? 'member');

    if (!loginResult.onboardingComplete && loginResult.onboardingSession) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Authentication successful. Complete onboarding to continue.',
        data: {
          requiresOnboarding: true,
          onboardingToken: loginResult.onboardingSession.onboardingToken,
          currentStep: loginResult.onboardingSession.currentStep,
          userType: loginResult.onboardingSession.userType,
        },
      });
      return;
    }

    if (!loginResult.authResponse) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_INVALID);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.AUTH.LOGIN_SUCCESS,
      data: loginResult.authResponse,
    });
  } catch (error) {
    next(error);
  }
};
