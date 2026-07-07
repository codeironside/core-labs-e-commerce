import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { HTTP_STATUS } from '../../constants/index.js';
import { MESSAGES } from '../../constants/messages/index.js';
import { AppError } from '../errorHandler/index.js';

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
    next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
    return;
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
    if (!user) {
      next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
      return;
    }

    if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minimumRole]) {
      next(new AppError(HTTP_STATUS.FORBIDDEN, MESSAGES.AUTH.FORBIDDEN));
      return;
    }

    next();
  };
}
