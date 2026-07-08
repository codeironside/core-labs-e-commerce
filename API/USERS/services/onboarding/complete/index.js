import { OnboardingCompleteSchema } from '@api/USERS/schemas/onboarding';
import { clearOnboardingState, getOnboardingState, saveOnboardingDraft, } from '@core/services/cache/onboarding';
import { findUserByEmail } from '@core/services/db/userLookup';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
import { loginByUserId } from '@api/AUTH/services/login';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { getRedisClient } from '@core/services/redis';
import { assertOnboardingReadyToComplete } from '../validateStep';
import { persistOnboardingUser } from '../persistUser';
const buildCompleteLockKey = (token) => `onboarding:complete-lock:${token}`;
export const completeOnboarding = async (req, res, next) => {
    const lockKey = req.body?.onboardingToken
        ? buildCompleteLockKey(String(req.body.onboardingToken))
        : null;
    try {
        const { onboardingToken, tutorialCompleted } = OnboardingCompleteSchema.parse(req.body);
        const state = await getOnboardingState(onboardingToken);
        if (!state) {
            throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired onboarding session.');
        }
        if (tutorialCompleted) {
            await saveOnboardingDraft(onboardingToken, { tutorialCompleted: true }, state.currentStep);
        }
        const refreshedState = (await getOnboardingState(onboardingToken)) ?? state;
        assertOnboardingReadyToComplete(refreshedState);
        const resolvedLockKey = buildCompleteLockKey(onboardingToken);
        const lockAcquired = await getRedisClient().set(resolvedLockKey, '1', 'EX', 120, 'NX');
        if (lockAcquired !== 'OK') {
            const normalizedEmail = refreshedState.account.email.trim().toLowerCase();
            const existingUser = await findUserByEmail(normalizedEmail, { onboardingComplete: true });
            if (existingUser) {
                const tokens = await loginByUserId(String(existingUser._id), refreshedState.rememberMe);
                await clearOnboardingState(onboardingToken, refreshedState);
                res.status(HTTP_STATUS.OK).json({
                    success: true,
                    message: 'Onboarding already completed.',
                    data: {
                        onboardingComplete: true,
                        userType: refreshedState.draft.userType,
                        redirectTo: refreshedState.draft.userType === ONBOARDING_USER_TYPES.VENDOR
                            ? '/vendor/sell'
                            : '/dashboard',
                        ...tokens,
                    },
                });
                return;
            }
            throw new AppError(HTTP_STATUS.CONFLICT, 'Onboarding completion already in progress.');
        }
        try {
            const { userId } = await persistOnboardingUser(refreshedState);
            await clearOnboardingState(onboardingToken, refreshedState);
            const tokens = await loginByUserId(userId, refreshedState.rememberMe);
            await publishKafkaEvent(KAFKA_TOPICS.ONBOARDING_COMPLETED, {
                userId,
                workspaceId: refreshedState.account.provisionalUserId,
                email: refreshedState.account.email,
                userType: refreshedState.draft.userType,
                role: refreshedState.account.workspaceRole,
                vendorProfile: refreshedState.draft.userType === ONBOARDING_USER_TYPES.VENDOR
                    ? refreshedState.draft
                    : undefined,
            }, userId);
            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Onboarding completed successfully.',
                data: {
                    onboardingComplete: true,
                    userType: refreshedState.draft.userType,
                    redirectTo: refreshedState.draft.userType === ONBOARDING_USER_TYPES.VENDOR
                        ? '/vendor/sell'
                        : '/dashboard',
                    ...tokens,
                },
            });
        }
        finally {
            await getRedisClient().del(resolvedLockKey);
        }
    }
    catch (error) {
        if (lockKey) {
            await getRedisClient().del(lockKey).catch(() => undefined);
        }
        next(error);
    }
};
