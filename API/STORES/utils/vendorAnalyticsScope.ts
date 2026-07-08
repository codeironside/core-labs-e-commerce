import mongoose from 'mongoose';
import { StoreManager, VendorStore } from '../models/index.js';

export type VendorCatalogScope =
  | { mode: 'owner'; vendorId: string }
  | { mode: 'manager'; storeIds: string[] };

export const resolveVendorCatalogScope = async (
  userId: string,
): Promise<VendorCatalogScope | null> => {
  const ownedStoreCount = await VendorStore.countDocuments({
    vendorId: userId,
    status: 'active',
  });

  if (ownedStoreCount > 0) {
    return { mode: 'owner', vendorId: userId };
  }

  const managedStores = await StoreManager.find({
    userId: new mongoose.Types.ObjectId(userId),
  })
    .select('storeId')
    .lean();

  if (managedStores.length === 0) {
    return null;
  }

  return {
    mode: 'manager',
    storeIds: managedStores.map((entry) => String(entry.storeId)),
  };
};

export const buildScopedProductFilter = (
  scope: VendorCatalogScope,
): Record<string, unknown> => {
  if (scope.mode === 'owner') {
    if (!mongoose.isValidObjectId(scope.vendorId)) {
      return { vendorId: scope.vendorId };
    }
    const vendorObjectId = new mongoose.Types.ObjectId(scope.vendorId);
    return {
      $or: [{ vendorId: vendorObjectId }, { vendorId: scope.vendorId }],
    };
  }

  return {
    storeId: {
      $in: scope.storeIds.map((storeId) => new mongoose.Types.ObjectId(storeId)),
    },
    status: { $ne: 'archived' },
  };
};

export const assertProductAccessibleInScope = async (
  scope: VendorCatalogScope,
  productId: string,
): Promise<boolean> => {
  const filter =
    scope.mode === 'owner'
      ? {
          _id: new mongoose.Types.ObjectId(productId),
          ...(buildScopedProductFilter(scope) as Record<string, unknown>),
        }
      : {
          _id: new mongoose.Types.ObjectId(productId),
          storeId: {
            $in: scope.storeIds.map((storeId) => new mongoose.Types.ObjectId(storeId)),
          },
        };

  const { Product } = await import('../../PRODUCTS/models/index.js');
  const product = await Product.findOne(filter).select('_id').lean();
  return Boolean(product);
};

export const assertLivestreamAccessibleInScope = async (
  userId: string,
  livestreamId: string,
): Promise<void> => {
  const { AppError } = await import('../../../CORE/handlers/error/index.js');
  const { SYSTEM_MESSAGES } = await import('../../../CORE/utils/constants/index.js');
  const { LivestreamSession } = await import('../../LIVESTREAMS/models/index.js');
  const livestream = await LivestreamSession.findById(livestreamId)
    .select('_id vendorId storeId')
    .lean();

  if (!livestream) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  if (String(livestream.vendorId) === userId) {
    return;
  }

  if (!livestream.storeId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const assignment = await StoreManager.findOne({
    storeId: livestream.storeId,
    userId: new mongoose.Types.ObjectId(userId),
  })
    .select('_id')
    .lean();

  if (!assignment) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }
};
