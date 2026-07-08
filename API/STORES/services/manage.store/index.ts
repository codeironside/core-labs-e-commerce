import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { User } from '../../../AUTH/models/index.js';
import { LivestreamSession } from '../../../LIVESTREAMS/models/index.js';
import { StoreManager, VendorStore } from '../../models/index.js';
import { listAccessibleStoreIds } from '../../utils/storeAccess.js';
import { resolveSessionUserId } from '../../utils/sessionUser.js';
import { serializeVendorStore } from '../../utils/resolveVendorStore.js';
import { serializeProducts } from '../../../PRODUCTS/utils/index.js';

const assertStoreOwner = async (storeId: string, userId: string) => {
  const store = await VendorStore.findById(storeId).select('_id vendorId status').lean();
  if (!store || store.status !== 'active') {
    throw new AppError('Store not found.', 404);
  }
  if (String(store.vendorId) !== userId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }
  return store;
};

const assertStoreInventoryEditor = async (storeId: string, userId: string) => {
  const store = await VendorStore.findById(storeId).select('_id vendorId status').lean();
  if (!store || store.status !== 'active') {
    throw new AppError('Store not found.', 404);
  }

  const isOwner = String(store.vendorId) === userId;
  if (isOwner) {
    return { store, canEdit: true };
  }

  const assignment = await StoreManager.findOne({
    storeId: store._id,
    userId: new mongoose.Types.ObjectId(userId),
    role: { $in: ['manager'] },
  })
    .select('_id')
    .lean();

  if (!assignment) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  return { store, canEdit: true };
};

export const fetchStoreController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = resolveSessionUserId(context);
    const storeId = context.req.param('storeId');
    if (!storeId) throw new AppError('Store not found.', 404);

    const accessibleIds = await listAccessibleStoreIds(userId, String(sessionUser.role ?? ''));
    if (!accessibleIds.includes(storeId)) {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
    }

    const store = await VendorStore.findById(storeId)
      .select('_id vendorId name slug description logoUrl coverImageUrl address location googlePlaceId isDefault status createdAt updatedAt')
      .lean();

    if (!store || store.status !== 'active') {
      throw new AppError('Store not found.', 404);
    }

    const [vendor, managers, assignedProducts, productTotal, activeProductCount, activeLivestream] = await Promise.all([
      User.findById(store.vendorId).select('name email').lean(),
      StoreManager.find({ storeId: store._id }).select('_id userId role createdAt').lean(),
      Product.find({ storeId: store._id, status: { $ne: 'archived' } })
        .select('_id name pricing media shortDescription status storeId inventory')
        .sort({ updatedAt: -1 })
        .lean(),
      Product.countDocuments({ storeId: store._id, status: { $ne: 'archived' } }),
      Product.countDocuments({ storeId: store._id, status: 'active' }),
      LivestreamSession.findOne({ storeId: store._id, status: 'active' })
        .select('_id title')
        .lean(),
    ]);

    const managerUserIds = managers.map((entry) => String(entry.userId));
    const managerUsers = managerUserIds.length
      ? await User.find({ _id: { $in: managerUserIds } }).select('_id name email').lean()
      : [];
    const managerMap = new Map(managerUsers.map((user) => [String(user._id), user]));

    return ResponseHandler.success(context, 'Store fetched successfully.', {
      store: {
        id: String(store._id),
        vendorId: String(store.vendorId),
        vendorName: vendor?.name ?? 'Vendor',
        name: store.name,
        slug: store.slug,
        description: store.description,
        logoUrl: store.logoUrl ?? null,
        coverImageUrl: store.coverImageUrl ?? null,
        address: store.address ?? null,
        location:
          store.location?.lat != null && store.location?.lng != null
            ? { lat: store.location.lat, lng: store.location.lng }
            : null,
        googlePlaceId: store.googlePlaceId ?? null,
        isDefault: store.isDefault,
        isOwner: String(store.vendorId) === userId,
        status: store.status,
        productCount: activeProductCount,
        assignedProductCount: productTotal,
        managerCount: managers.length,
        activeLivestream: activeLivestream
          ? { id: String(activeLivestream._id), title: activeLivestream.title }
          : null,
        managers: managers.map((entry) => {
          const profile = managerMap.get(String(entry.userId));
          return {
            id: String(entry._id),
            userId: String(entry.userId),
            role: entry.role,
            name: profile?.name ?? 'User',
            email: profile?.email ?? '',
            createdAt: entry.createdAt,
          };
        }),
        products: serializeProducts(assignedProducts),
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch store');
    throw new AppError('Failed to fetch store.', 500);
  }
};

export const updateStoreController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = resolveSessionUserId(context);
    const storeId = context.req.param('storeId');
    if (!storeId) throw new AppError('Store not found.', 404);

    await assertStoreOwner(storeId, userId);

    const body = await context.req.json().catch(() => ({}));
    const { updateStoreSchema } = await import('../../schemas/index.js');
    const parsed = updateStoreSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    const updates = parsed.data;
    if (updates.isDefault === true) {
      await VendorStore.updateMany(
        {
          vendorId: new mongoose.Types.ObjectId(userId),
          _id: { $ne: new mongoose.Types.ObjectId(storeId) },
        },
        { $set: { isDefault: false } },
      );
    }

    const store = await VendorStore.findByIdAndUpdate(
      storeId,
      { $set: updates },
      { new: true },
    ).lean();

    if (!store) throw new AppError('Store not found.', 404);

    logger.info({ storeId, userId }, 'Store updated');

    return ResponseHandler.success(context, 'Store updated successfully.', {
      store: serializeVendorStore(store),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to update store');
    throw new AppError('Failed to update store.', 500);
  }
};

export const assignStoreProductsController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = resolveSessionUserId(context);
    const storeId = context.req.param('storeId');
    if (!storeId) throw new AppError('Store not found.', 404);

    const store = await assertStoreOwner(storeId, userId);

    const body = await context.req.json().catch(() => ({}));
    const { assignStoreProductsSchema } = await import('../../schemas/index.js');
    const parsed = assignStoreProductsSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    const { productIds, action, publish } = parsed.data;
    const objectIds = productIds.map((id) => new mongoose.Types.ObjectId(id));

    if (action === 'assign') {
      const assignUpdate: Record<string, unknown> = { storeId: store._id };
      if (publish) {
        assignUpdate.status = 'active';
        assignUpdate.publishedAt = new Date();
      }

      const result = await Product.updateMany(
        {
          _id: { $in: objectIds },
          vendorId: store.vendorId,
          status: { $ne: 'archived' },
        },
        { $set: assignUpdate },
      );
      return ResponseHandler.success(context, 'Products assigned to store.', {
        modifiedCount: result.modifiedCount,
        published: publish,
      });
    }

    if (action === 'publish') {
      const result = await Product.updateMany(
        {
          _id: { $in: objectIds },
          vendorId: store.vendorId,
          storeId: store._id,
          status: 'draft',
        },
        { $set: { status: 'active', publishedAt: new Date() } },
      );
      return ResponseHandler.success(context, 'Products published to storefront.', {
        modifiedCount: result.modifiedCount,
      });
    }

    const result = await Product.updateMany(
      { _id: { $in: objectIds }, vendorId: store.vendorId, storeId: store._id },
      { $unset: { storeId: '' } },
    );

    return ResponseHandler.success(context, 'Products removed from store.', {
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to assign store products');
    throw new AppError('Failed to update store products.', 500);
  }
};

export const updateStoreProductInventoryController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = resolveSessionUserId(context);
    const storeId = context.req.param('storeId');
    const productId = context.req.param('productId');
    if (!storeId || !productId) throw new AppError('Store product not found.', 404);

    const { store } = await assertStoreInventoryEditor(storeId, userId);
    const body = await context.req.json().catch(() => ({}));
    const { updateStoreProductInventorySchema } = await import('../../schemas/index.js');
    const parsed = updateStoreProductInventorySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    const quantity = parsed.data.quantity;
    if (quantity > 0 && quantity < 2) {
      throw new AppError('Inventory quantity must be at least 2 (or 0 for out of stock).', 400);
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        vendorId: store.vendorId,
        storeId: store._id,
        status: { $ne: 'archived' },
      },
      {
        $set: {
          'inventory.quantity': quantity,
        },
      },
      { new: true },
    )
      .select('_id inventory')
      .lean();

    if (!product) {
      throw new AppError('Store product not found.', 404);
    }

    logger.info({ storeId, productId, userId, quantity }, 'Store product inventory updated');

    return ResponseHandler.success(context, 'Store product inventory updated.', {
      productId: String(product._id),
      inventory: product.inventory,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to update store product inventory');
    throw new AppError('Failed to update store product inventory.', 500);
  }
};
