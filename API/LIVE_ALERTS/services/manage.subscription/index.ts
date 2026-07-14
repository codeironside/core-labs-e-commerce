import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { VendorStore } from '../../../STORES/models/index.js';
import { User } from '../../../AUTH/models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { LiveAlertSubscription } from '../../models/index.js';
import {
  fetchLiveAlertStatusQuerySchema,
  removeLiveAlertSubscriptionSchema,
  upsertLiveAlertSubscriptionSchema,
} from '../../schemas/index.js';

const assertLiveAlertTargetExists = async (
  targetType: 'store' | 'vendor' | 'product',
  targetId: string,
): Promise<void> => {
  if (targetType === 'store') {
    const store = await VendorStore.findOne({ _id: targetId, status: 'active' })
      .select('_id')
      .lean();
    if (!store) {
      throw new AppError('Store not found.', 404);
    }
    return;
  }

  if (targetType === 'product') {
    const product = await Product.findById(targetId).select('_id').lean();
    if (!product) {
      throw new AppError('Product not found.', 404);
    }
    return;
  }

  const vendor = await User.findById(targetId).select('_id userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError('Vendor not found.', 404);
  }
};

export const upsertLiveAlertSubscriptionController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const body = await context.req.json().catch(() => ({}));
    const parsed = upsertLiveAlertSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    await assertLiveAlertTargetExists(parsed.data.targetType, parsed.data.targetId);

    const subscription = await LiveAlertSubscription.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        targetType: parsed.data.targetType,
        targetId: new mongoose.Types.ObjectId(parsed.data.targetId),
      },
      {
        $set: {
          channels: parsed.data.channels,
          ...(parsed.data.contactPhone ? { contactPhone: parsed.data.contactPhone } : {}),
        },
      },
      { upsert: true, new: true },
    ).lean();

    logger.info(
      { userId, targetType: parsed.data.targetType, targetId: parsed.data.targetId },
      'Live alert subscription saved',
    );

    return ResponseHandler.success(context, 'Live alerts enabled.', {
      subscription: {
        id: String(subscription?._id),
        targetType: subscription?.targetType,
        targetId: String(subscription?.targetId),
        channels: subscription?.channels,
        contactPhone: subscription?.contactPhone ?? null,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to save live alert subscription');
    throw new AppError('Failed to save live alert subscription.', 500);
  }
};

export const removeLiveAlertSubscriptionController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const body = await context.req.json().catch(() => ({}));
    const parsed = removeLiveAlertSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    await LiveAlertSubscription.deleteOne({
      userId: new mongoose.Types.ObjectId(userId),
      targetType: parsed.data.targetType,
      targetId: new mongoose.Types.ObjectId(parsed.data.targetId),
    });

    return ResponseHandler.success(context, 'Live alerts turned off.', {});
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to remove live alert subscription');
    throw new AppError('Failed to remove live alert subscription.', 500);
  }
};

export const fetchLiveAlertStatusController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const parsed = fetchLiveAlertStatusQuerySchema.safeParse(context.req.query());
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    const subscription = await LiveAlertSubscription.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      targetType: parsed.data.targetType,
      targetId: new mongoose.Types.ObjectId(parsed.data.targetId),
    })
      .select('channels contactPhone')
      .lean();

    return ResponseHandler.success(context, 'Live alert status fetched.', {
      subscribed: Boolean(subscription),
      channels: subscription?.channels ?? null,
      contactPhone: subscription?.contactPhone ?? null,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch live alert status');
    throw new AppError('Failed to fetch live alert status.', 500);
  }
};

export const fetchMyLiveAlertSubscriptionsController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
    const subscriptions = await LiveAlertSubscription.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .select('targetType targetId channels contactPhone createdAt')
      .sort({ updatedAt: -1 })
      .lean();

    return ResponseHandler.success(context, 'Live alert subscriptions fetched.', {
      subscriptions: subscriptions.map((entry) => ({
        id: String(entry._id),
        targetType: entry.targetType,
        targetId: String(entry.targetId),
        channels: entry.channels,
        contactPhone: entry.contactPhone ?? null,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch live alert subscriptions');
    throw new AppError('Failed to fetch live alert subscriptions.', 500);
  }
};
