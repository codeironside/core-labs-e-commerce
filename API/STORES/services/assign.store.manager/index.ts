import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { StoreManager, VendorStore } from '../../models/index.js';
import { assignStoreManagerSchema } from '../../schemas/index.js';

export const assignStoreManagerController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const vendorId = String(sessionUser.id ?? sessionUser._id);
    const storeId = context.req.param('storeId');
    if (!storeId) throw new AppError('Store not found.', 404);

    const store = await VendorStore.findById(storeId).select('_id vendorId status').lean();
    if (!store || store.status !== 'active') throw new AppError('Store not found.', 404);
    if (String(store.vendorId) !== vendorId) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
    }

    const body = await context.req.json().catch(() => ({}));
    const parsed = assignStoreManagerSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    if (parsed.data.userId === vendorId) {
      throw new AppError('Store owner cannot be assigned as a manager.', 400);
    }

    const assignee = await User.findById(parsed.data.userId).select('_id name email').lean();
    if (!assignee) throw new AppError('User not found.', 404);
    const normalizedRole = 'manager';

    const manager = await StoreManager.findOneAndUpdate(
      {
        storeId: store._id,
        userId: new mongoose.Types.ObjectId(parsed.data.userId),
      },
      {
        $set: { role: normalizedRole },
        $setOnInsert: {
          storeId: store._id,
          userId: new mongoose.Types.ObjectId(parsed.data.userId),
          invitedBy: new mongoose.Types.ObjectId(vendorId),
        },
      },
      { upsert: true, new: true },
    ).lean();

    logger.info({ storeId, managerUserId: parsed.data.userId, role: normalizedRole }, 'Store manager assigned');

    return ResponseHandler.success(context, 'Store manager assigned successfully.', {
      manager: {
        id: String(manager?._id),
        storeId,
        userId: parsed.data.userId,
        role: normalizedRole,
        name: assignee.name,
        email: assignee.email,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to assign store manager');
    throw new AppError('Failed to assign store manager.', 500);
  }
};

export const removeStoreManagerController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const vendorId = String(sessionUser.id ?? sessionUser._id);
    const storeId = context.req.param('storeId');
    const managerUserId = context.req.param('userId');
    if (!storeId || !managerUserId) throw new AppError('Store manager not found.', 404);

    const store = await VendorStore.findById(storeId).select('_id vendorId').lean();
    if (!store) throw new AppError('Store not found.', 404);
    if (String(store.vendorId) !== vendorId) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
    }

    await StoreManager.deleteOne({
      storeId: store._id,
      userId: new mongoose.Types.ObjectId(managerUserId),
    });

    logger.info({ storeId, managerUserId }, 'Store manager removed');

    return ResponseHandler.success(context, 'Store manager removed successfully.', {});
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to remove store manager');
    throw new AppError('Failed to remove store manager.', 500);
  }
};
