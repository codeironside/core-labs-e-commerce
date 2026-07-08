import type { Context, Next } from 'hono';
import mongoose from 'mongoose';
import { AppError } from '../../handlers/error/index.js';

export const ensureDatabaseConnected = async (_context: Context, next: Next): Promise<void> => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError('Database unavailable. Restart the e-commerce service.', 503);
  }
  await next();
};
