import type { Context } from 'hono';
import { AppError } from '../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../CORE/utils/constants/index.js';

type SessionUser = {
  userId?: string;
  id?: string;
  _id?: string;
};

export const resolveSessionUserId = (context: Context): string => {
  const sessionUser = context.get('user') as SessionUser | undefined;
  const userId = sessionUser?.userId ?? sessionUser?.id ?? sessionUser?._id;
  if (!userId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }
  return String(userId);
};
