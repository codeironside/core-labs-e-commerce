import { OAuthSignupRoleSchema } from '@api/AUTH/schemas';
import { getOAuthProvider } from '@core/services/oauth';
import { createOAuthState } from '@core/services/oauth/oauthState';
import { assertSignupRoleAllowed } from '../login';
import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
const parseSignupRole = (value) => {
    const parsed = OAuthSignupRoleSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
};
export const oauthProvider = async (req, res, next) => {
    try {
        const provider = req.params.provider;
        const intent = req.query.intent === 'signup' ? 'signup' : 'login';
        const signupRole = parseSignupRole(req.query.signupRole);
        if (intent === 'signup' && !signupRole) {
            throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Account type is required for OAuth signup.');
        }
        let state;
        if (intent === 'signup' && signupRole) {
            await assertSignupRoleAllowed(signupRole);
            state = await createOAuthState({ signupRole, intent: 'signup' });
        }
        else {
            state = await createOAuthState({ intent: 'login' });
        }
        const url = getOAuthProvider(provider).getAuthUrl(state);
        res.redirect(url);
    }
    catch (err) {
        next(err);
    }
};
