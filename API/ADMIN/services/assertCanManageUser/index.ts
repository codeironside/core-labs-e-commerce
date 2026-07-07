import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
import type { UserRole } from '@api/AUTH/models/user';
import type { IUserDocument } from '@api/AUTH/models';

type AdminActor = { userId: string; role: UserRole };

export const assertCanManageTargetUser = (actor: AdminActor, target: IUserDocument): void => {
  if (target.role === 'super_admin' && actor.role !== 'super_admin') {
    throw new AppError(HTTP_STATUS.FORBIDDEN, 'Admins cannot manage super admin accounts.');
  }

  if (String(target._id) === actor.userId && target.role === 'super_admin') {
    throw new AppError(HTTP_STATUS.FORBIDDEN, 'Super admins cannot modify their own privileged account here.');
  }
};

export const buildAdminUserListFilter = (actorRole: UserRole): Record<string, unknown> => {
  if (actorRole === 'super_admin') {
    return {};
  }
  return { role: { $ne: 'super_admin' } };
};

export const buildAssignableRoles = (actorRole: UserRole): UserRole[] => {
  if (actorRole === 'super_admin') {
    return ['viewer', 'member', 'editor', 'admin', 'super_admin'];
  }
  return ['viewer', 'member', 'editor', 'admin'];
};
