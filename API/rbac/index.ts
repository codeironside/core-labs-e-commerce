import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@core/config';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { AppError } from '@core/middleware/errorHandler';

export type UserRole = 'super_admin' | 'admin' | 'editor' | 'member' | 'viewer';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    workspaceId: string;
    role: UserRole;
    rememberMe: boolean;
  };
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 5,
  admin: 4,
  editor: 3,
  member: 2,
  viewer: 1,
};

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
  }

  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AuthenticatedRequest['user'];
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_INVALID));
  }
}

export function requireRole(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));

    if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minimumRole]) {
      return next(new AppError(HTTP_STATUS.FORBIDDEN, MESSAGES.AUTH.FORBIDDEN));
    }
    next();
  };
}
