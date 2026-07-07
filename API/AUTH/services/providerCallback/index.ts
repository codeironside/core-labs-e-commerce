import { Request, Response, NextFunction } from 'express';
import { OAuthCallbackSchema } from '@api/AUTH/schemas';
import { getOAuthProvider } from '@core/services/oauth';
import { consumeOAuthState } from '@core/services/oauth/oauthState';
import { loginOAuthUser } from '../login';
import { config } from '@core/config';

export const providerCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const provider = req.params.provider as 'google' | 'github';
    const { code, state } = OAuthCallbackSchema.parse(req.query);
    const oauthService = getOAuthProvider(provider);
    const { accessToken: oauthToken } = await oauthService.exchangeCode(code);
    const profile = await oauthService.getUserProfile(oauthToken);

    const oauthState = state ? await consumeOAuthState(state) : null;
    const intent = oauthState?.intent ?? 'login';
    const signupRole = oauthState?.signupRole;

    const loginResult = await loginOAuthUser(profile, { intent, signupRole });
    const redirectUrl = new URL('/oauth/callback', config.frontendUrl);

    if (loginResult.requiresSignupRole && loginResult.oauthPendingToken) {
      redirectUrl.searchParams.set('requiresSignupRole', 'true');
      redirectUrl.searchParams.set('oauthPendingToken', loginResult.oauthPendingToken);
      res.redirect(redirectUrl.toString());
      return;
    }

    if (!loginResult.onboardingComplete && loginResult.onboardingSession) {
      redirectUrl.searchParams.set('requiresOnboarding', 'true');
      redirectUrl.searchParams.set('onboardingToken', loginResult.onboardingSession.onboardingToken);
      if (loginResult.onboardingSession.userType) {
        redirectUrl.searchParams.set('userType', loginResult.onboardingSession.userType);
      }
      res.redirect(redirectUrl.toString());
      return;
    }

    if (!loginResult.tokens) {
      throw new Error('OAuth login completed without tokens.');
    }

    redirectUrl.searchParams.set('accessToken', loginResult.tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', loginResult.tokens.refreshToken);
    res.redirect(redirectUrl.toString());
  } catch (err) {
    next(err);
  }
};
