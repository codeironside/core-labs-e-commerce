import bcrypt from 'bcryptjs';
import { RegisterSchema } from '../../schemas';
import { assertSignupRoleAllowed } from '../login';
import { createAndSendOtp } from '../otp';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { resumeOnboardingByEmail } from '@core/services/onboardingSession';
import { getOnboardingSessionByEmail } from '@core/services/cache/onboarding';
import { setPendingSignup } from '@core/services/cache/pendingSignup';
import { findUserByEmail } from '@core/services/db/userLookup';
import { AppError } from '@core/middleware/errorHandler';
import { purgeLegacyIncompleteMongoUser } from '@api/USERS/services/onboarding/deleteIncompleteUser';
export const register = async (req, res, next) => {
    try {
        const payload = RegisterSchema.parse(req.body);
        const signupRole = (payload.role ?? 'member');
        const workspaceRole = await assertSignupRoleAllowed(signupRole);
        const completeUser = await findUserByEmail(payload.email, { onboardingComplete: true });
        if (completeUser) {
            throw new AppError(HTTP_STATUS.CONFLICT, MESSAGES.AUTH.EMAIL_ALREADY_EXISTS);
        }
        await purgeLegacyIncompleteMongoUser(payload.email);
        const redisSession = await getOnboardingSessionByEmail(payload.email);
        if (redisSession?.state.account.passwordHash) {
            if (!(await bcrypt.compare(payload.password, redisSession.state.account.passwordHash))) {
                throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
            }
            const onboarding = await resumeOnboardingByEmail(payload.email);
            if (!onboarding) {
                throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
            }
            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Resume your onboarding to continue.',
                data: {
                    requiresOnboarding: true,
                    onboardingToken: onboarding.onboardingToken,
                    currentStep: onboarding.currentStep,
                    userType: onboarding.userType,
                },
            });
            return;
        }
        const passwordHash = await bcrypt.hash(payload.password, 12);
        await setPendingSignup({
            name: payload.name,
            email: payload.email,
            passwordHash,
            signupRole,
            workspaceRole,
            rememberMe: payload.rememberMe,
            createdAt: new Date().toISOString(),
        });
        await createAndSendOtp(payload.email, 'email_verification');
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: MESSAGES.AUTH.REGISTERED,
            data: {
                email: payload.email,
                verificationSent: true,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
