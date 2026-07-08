import { UserModel, AccountModel } from '@api/AUTH/models';
import { clearOnboardingState, getOnboardingSessionByEmail } from '@core/services/cache/onboarding';
import { purgeIncompleteUsersByEmail } from '@core/services/db/userLookup';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { logger } from '@core/services/logger';
export const purgeLegacyIncompleteMongoUser = async (email) => {
    await purgeIncompleteUsersByEmail(email);
    logger.info({ email }, 'Incomplete users purged from canonical and legacy collections');
};
export const expireOnboardingSession = async (email) => {
    const session = await getOnboardingSessionByEmail(email);
    if (!session) {
        return false;
    }
    await clearOnboardingState(session.token, session.state);
    await publishKafkaEvent(KAFKA_TOPICS.ONBOARDING_EXPIRED, { userId: session.state.userId, email: session.state.account.email }, session.state.userId);
    logger.info({ email, userId: session.state.userId }, 'Redis onboarding session expired');
    return true;
};
export const deleteIncompleteUser = async (userId) => {
    const user = await UserModel.findById(userId).select('_id email onboardingComplete').lean();
    if (!user || user.onboardingComplete) {
        return false;
    }
    await expireOnboardingSession(user.email);
    await AccountModel.deleteMany({ userId });
    await purgeIncompleteUsersByEmail(user.email);
    await publishKafkaEvent(KAFKA_TOPICS.ONBOARDING_EXPIRED, { userId, email: user.email }, userId);
    logger.info({ userId, email: user.email }, 'Incomplete onboarding user deleted');
    return true;
};
