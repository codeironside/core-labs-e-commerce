import { UserModel, type UserRole } from '@api/AUTH/models';
import { ONBOARDING_USER_TYPES } from '@core/constants/onboarding';

const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const fetchPlatformAnalytics = async (
  actorRole: UserRole,
): Promise<{
  users: {
    total: number;
    vendors: number;
    buyers: number;
    editors: number;
    admins: number;
    platformBanned: number;
    livestreamBanned: number;
    signupsLast7Days: number;
  };
  actorScope: 'super_admin' | 'admin';
}> => {
  const weekAgo = new Date(Date.now() - DAYS_IN_WEEK * MS_PER_DAY);
  const roleFilter =
    actorRole === 'super_admin' ? {} : { role: { $ne: 'super_admin' as const } };

  const [
    total,
    vendors,
    buyers,
    editors,
    admins,
    platformBanned,
    livestreamBanned,
    signupsLast7Days,
  ] = await Promise.all([
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
