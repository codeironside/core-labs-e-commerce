import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { CompleteOAuthSignupSchema } from '@api/AUTH/schemas';
import { assertSignupRoleAllowed } from '../login';
import { resolveOnboardingSession } from '@core/services/onboardingSession';
import { consumeOAuthPendingSession } from '@core/services/oauth/oauthPending';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { AppError } from '@core/middleware/errorHandler';

export const completeOAuthSignup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { oauthPendingToken, signupRole } = CompleteOAuthSignupSchema.parse(req.body);
    const profile = await consumeOAuthPendingSession(oauthPendingToken);

    if (!profile) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Your sign-in session expired. Please try again.');
    }

    const workspaceRole = await assertSignupRoleAllowed(signupRole);
    const onboardingSession = await resolveOnboardingSession({
      account: {
        provisionalUserId: crypto.randomUUID(),
        name: profile.name,
        email: profile.email.toLowerCase(),
        workspaceRole,
        signupRole,
        authMethod: profile.provider,
        oauthProvider: profile.provider,
        oauthProviderId: profile.id,
        profileImage: profile.avatarUrl,
        avatarUrl: profile.avatarUrl,
      },
      signupRole,
      requiresPhoneNumber: true,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.AUTH.LOGIN_SUCCESS,
      data: {
        requiresOnboarding: true,
        onboardingToken: onboardingSession.onboardingToken,
        currentStep: onboardingSession.currentStep,
        userType: onboardingSession.userType,
      },
    });
  } catch (err) {
    next(err);
  }
};
