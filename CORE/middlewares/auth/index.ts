import jwt from 'jsonwebtoken';
import type { Context, Next } from 'hono';
import { config } from '../../config/index.js';
import { AppError } from '../../handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../utils/constants/index.js';

export type IdentitySessionUser = {
  id: string;
  userId: string;
  workspaceId: string;
  role: string;
  userType?: string;
};

export const attachIdentityAuth = async (context: Context, next: Next): Promise<void> => {
  const header = context.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }

  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, config.app.JWT_ACCESS_SECRET) as {
      userId: string;
      workspaceId: string;
      role: string;
      userType?: string;
    };

    context.set('user', {
      id: payload.userId,
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      role: payload.role,
      ...(payload.userType ? { userType: payload.userType } : {}),
    } satisfies IdentitySessionUser);
    await next();
  } catch {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }
};

export const attachOptionalIdentityAuth = async (context: Context, next: Next): Promise<void> => {
  const header = context.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    await next();
    return;
  }

  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, config.app.JWT_ACCESS_SECRET) as {
      userId: string;
      workspaceId: string;
      role: string;
      userType?: string;
    };

    context.set('user', {
      id: payload.userId,
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      role: payload.role,
      ...(payload.userType ? { userType: payload.userType } : {}),
    } satisfies IdentitySessionUser);
  } catch {
    // Optional auth — invalid tokens are ignored for public browsing.
  }
  await next();
};
