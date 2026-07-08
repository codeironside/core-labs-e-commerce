import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { VendorStore } from '../../models/index.js';
import { createStoreSchema } from '../../schemas/index.js';
import { resolveSessionUserId } from '../../utils/sessionUser.js';
import { serializeVendorStore } from '../../utils/resolveVendorStore.js';
import { buildUniqueStoreSlug } from '../../utils/slug.js';

export const createStoreController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const vendorId = resolveSessionUserId(context);
    const vendor = await User.findById(vendorId).select('userType role name').lean();
    const userType = String(vendor?.userType ?? '').toLowerCase();
    const role = String(vendor?.role ?? '').toLowerCase();
    const canManageStores =
      userType === 'vendor' || role === 'admin' || role === 'super_admin';
    if (!vendor || !canManageStores) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
    }

    const body = await context.req.json().catch(() => ({}));
    const parsed = createStoreSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    const slug = await buildUniqueStoreSlug(parsed.data.name, async (candidate) => {
      const existing = await VendorStore.findOne({ slug: candidate }).select('_id').lean();
      return Boolean(existing);
    });

    const existingStoreCount = await VendorStore.countDocuments({
      vendorId: new mongoose.Types.ObjectId(vendorId),
      status: 'active',
    });

    const store = await VendorStore.create({
      vendorId: new mongoose.Types.ObjectId(vendorId),
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      logoUrl: parsed.data.logoUrl,
      coverImageUrl: parsed.data.coverImageUrl,
      ...(parsed.data.address ? { address: parsed.data.address } : {}),
      ...(parsed.data.location ? { location: parsed.data.location } : {}),
      ...(parsed.data.googlePlaceId ? { googlePlaceId: parsed.data.googlePlaceId } : {}),
      status: 'active',
      isDefault: existingStoreCount === 0,
    });

    logger.info({ vendorId, storeId: store._id, slug }, 'Vendor store created');

    return ResponseHandler.success(
      context,
      'Store created successfully.',
      { store: serializeVendorStore(store) },
      undefined,
      201,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to create store');
    throw new AppError('Failed to create store.', 500);
  }
};
