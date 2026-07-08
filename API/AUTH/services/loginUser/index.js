import bcrypt from 'bcryptjs';
import { LoginSchema } from '@api/AUTH/schemas';
import { MESSAGES } from '@core/constants/messages';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { createAndSendOtp } from '../otp';
import { getPendingSignup } from '@core/services/cache/pendingSignup';
import { getOnboardingSessionByEmail } from '@core/services/cache/onboarding';
import { purgeLegacyIncompleteMongoUser } from '@api/USERS/services/onboarding/deleteIncompleteUser';
import { findUserByEmail } from '@core/services/db/userLookup';
import { assertUserNotPlatformBanned } from '@api/AUTH/services/assertNotBanned';
export const loginUser = async (req, res, next) => {
    try {
        const payload = LoginSchema.parse(req.body);
        await purgeLegacyIncompleteMongoUser(payload.email);
        const completeUser = await findUserByEmail(payload.email, { onboardingComplete: true }, {
            select: '+passwordHash',
        });
        if (completeUser) {
            assertUserNotPlatformBanned(completeUser);
            if (!(await completeUser.comparePassword(payload.password))) {
                throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
            }
            await createAndSendOtp(payload.email, 'login_2fa');
            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Verification code sent to your email.',
                data: { requires2FA: true, email: payload.email, rememberMe: payload.rememberMe },
            });
            return;
        }
        const pending = await getPendingSignup(payload.email);
        if (pending) {
            if (!(await bcrypt.compare(payload.password, pending.passwordHash))) {
                throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
            }
            await createAndSendOtp(payload.email, 'email_verification');
            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: MESSAGES.AUTH.VERIFY_EMAIL_FIRST,
                data: {
                    requiresEmailVerification: true,
                    email: payload.email,
                    rememberMe: payload.rememberMe,
                },
            });
            return;
        }
        const onboardingSession = await getOnboardingSessionByEmail(payload.email);
        if (onboardingSession?.state.account.passwordHash) {
            if (!(await bcrypt.compare(payload.password, onboardingSession.state.account.passwordHash))) {
                throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
            }
            await createAndSendOtp(payload.email, 'login_2fa');
            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Verification code sent to your email.',
                data: { requires2FA: true, email: payload.email, rememberMe: payload.rememberMe },
            });
            return;
        }
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
    catch (err) {
        next(err);
    }
};
