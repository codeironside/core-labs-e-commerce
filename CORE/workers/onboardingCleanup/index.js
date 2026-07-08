import { config } from '@core/config';
import { logger } from '@core/services/logger';
import { UserModel } from '@api/AUTH/models';
import { deleteIncompleteUser } from '@api/USERS/services/onboarding/deleteIncompleteUser';
let intervalRef = null;
export const runOnboardingCleanup = async () => {
    const cutoff = new Date(Date.now() - config.onboarding.ttlSeconds * 1000);
    const legacyIncompleteUsers = await UserModel.find({
        onboardingComplete: false,
        createdAt: { $lt: cutoff },
    })
        .select('_id')
        .lean();
    await Promise.all(legacyIncompleteUsers.map(async (user) => {
        try {
            await deleteIncompleteUser(String(user._id));
        }
        catch (error) {
            logger.error({ error, userId: String(user._id) }, 'Legacy onboarding cleanup failed');
        }
    }));
    if (legacyIncompleteUsers.length > 0) {
        logger.info({ count: legacyIncompleteUsers.length }, 'Legacy Mongo onboarding cleanup completed');
    }
};
export const startOnboardingCleanupWorker = () => {
    if (intervalRef) {
        return;
    }
    intervalRef = setInterval(() => {
        runOnboardingCleanup().catch((error) => {
            logger.error({ error }, 'Onboarding cleanup worker error');
        });
    }, config.onboarding.cleanupIntervalMs);
    logger.info({ intervalMs: config.onboarding.cleanupIntervalMs, ttlSeconds: config.onboarding.ttlSeconds }, 'Onboarding cleanup worker started');
};
export const stopOnboardingCleanupWorker = () => {
    if (intervalRef) {
        clearInterval(intervalRef);
        intervalRef = null;
    }
};
