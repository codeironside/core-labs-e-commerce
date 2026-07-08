import { OnboardingTokenSchema } from '@api/USERS/schemas/onboarding';
import { getOnboardingState } from '@core/services/cache/onboarding';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
export const getOnboardingStateHandler = async (req, res, next) => {
    try {
        const { onboardingToken } = OnboardingTokenSchema.parse(req.body);
        const state = await getOnboardingState(onboardingToken);
        if (!state) {
            throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired onboarding session.');
        }
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Onboarding state retrieved.',
            data: {
                currentStep: state.currentStep,
                draft: state.draft,
                requiresPhoneNumber: state.requiresPhoneNumber,
                role: state.role,
                signupRole: state.account.signupRole,
                userType: state.draft.userType,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
