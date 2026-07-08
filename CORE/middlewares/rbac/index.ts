import type { Context, Next } from 'hono';
import { AppError } from '../../handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../utils/constants/index.js';
import { USER_TYPES } from '../../utils/constants/index.js';
import type { IdentitySessionUser } from '../auth/index.js';
import { User } from '../../../API/AUTH/models/index.js';

const resolveSessionUser = (context: Context): IdentitySessionUser => {
  const sessionUser = context.get('user') as IdentitySessionUser | undefined;
  if (!sessionUser?.userId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }
  return sessionUser;
};

type ResolvedAuthorization = {
  userType: string;
  role: string;
};

const resolveAuthorization = async (
  sessionUser: IdentitySessionUser,
): Promise<ResolvedAuthorization> => {
  const tokenUserType = String(sessionUser.userType ?? '').toLowerCase();
  const tokenRole = String(sessionUser.role ?? '').toLowerCase();

  if (tokenUserType) {
    return { userType: tokenUserType, role: tokenRole };
  }

  const dbUser = await User.findById(sessionUser.userId).select('role userType').lean();
  if (!dbUser) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }

  return {
    userType: String(dbUser.userType ?? '').toLowerCase(),
    role: String(dbUser.role ?? '').toLowerCase(),
  };
};

const isRoleAllowed = (allowedRoles: string[], authorization: ResolvedAuthorization): boolean =>
  allowedRoles.some((allowedRole) => {
    const normalized = allowedRole.toLowerCase();
    if (normalized === USER_TYPES.VENDOR) {
      return authorization.userType === USER_TYPES.VENDOR;
    }
    if (normalized === 'user' || normalized === 'member') {
      return true;
    }
    return (
      authorization.role === normalized ||
      authorization.role === 'super_admin' ||
      authorization.role === 'admin'
    );
  });

export const requireAuth = () => async (context: Context, next: Next): Promise<void> => {
  resolveSessionUser(context);
  await next();
};

export const requireVendor = () => async (context: Context, next: Next): Promise<void> => {
  const sessionUser = resolveSessionUser(context);
  const authorization = await resolveAuthorization(sessionUser);
  if (authorization.userType !== USER_TYPES.VENDOR) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }
  await next();
};

export const requireRole = (allowedRoles: string[]) => async (context: Context, next: Next): Promise<void> => {
  const sessionUser = resolveSessionUser(context);
  const authorization = await resolveAuthorization(sessionUser);

  if (!isRoleAllowed(allowedRoles, authorization)) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  await next();
};
