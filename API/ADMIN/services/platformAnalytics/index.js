import { UserModel } from '@api/AUTH/models';
import { ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const fetchPlatformAnalytics = async (actorRole) => {
    const weekAgo = new Date(Date.now() - DAYS_IN_WEEK * MS_PER_DAY);
    const roleFilter = actorRole === 'super_admin' ? {} : { role: { $ne: 'super_admin' } };
    const [total, vendors, buyers, editors, admins, platformBanned, livestreamBanned, signupsLast7Days,] = await Promise.all([
        UserModel.countDocuments(roleFilter),
        UserModel.countDocuments({ ...roleFilter, userType: ONBOARDING_USER_TYPES.VENDOR }),
        UserModel.countDocuments({ ...roleFilter, userType: ONBOARDING_USER_TYPES.BUYER }),
        UserModel.countDocuments({ ...roleFilter, userType: ONBOARDING_USER_TYPES.EDITOR }),
        UserModel.countDocuments({
            ...roleFilter,
            role: actorRole === 'super_admin' ? { $in: ['admin', 'super_admin'] } : 'admin',
        }),
        UserModel.countDocuments({ ...roleFilter, platformBanned: true }),
        UserModel.countDocuments({ ...roleFilter, livestreamBanned: true }),
        UserModel.countDocuments({ ...roleFilter, createdAt: { $gte: weekAgo } }),
    ]);
    return {
        users: {
            total,
            vendors,
            buyers,
            editors,
            admins,
            platformBanned,
            livestreamBanned,
            signupsLast7Days,
        },
        actorScope: actorRole === 'super_admin' ? 'super_admin' : 'admin',
    };
};
