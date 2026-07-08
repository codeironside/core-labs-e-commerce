import mongoose from 'mongoose';
import { AppError } from '../../../CORE/handlers/error/index.js';
import { StoreManager, VendorStore } from '../models/index.js';
import type { StoreManagerRole } from '../models/index.js';

export const toObjectId = (value: string): mongoose.Types.ObjectId =>
  new mongoose.Types.ObjectId(value);

export type StoreHostAccess = {
  vendorId: string;
  storeId?: string;
  canStream: boolean;
  isStoreOwner: boolean;
};

const STREAM_ROLES: StoreManagerRole[] = ['manager', 'streamer'];

export const resolveStoreHostAccess = async (
  userId: string,
  storeId?: string,
): Promise<StoreHostAccess> => {
  if (!storeId) {
    return { vendorId: userId, canStream: true, isStoreOwner: true };
  }

  const store = await VendorStore.findById(storeId)
    .select('_id vendorId status')
    .lean();

  if (!store || store.status !== 'active') {
    throw new AppError('Store not found.', 404);
  }

  const vendorId = String(store.vendorId);
  if (vendorId === userId) {
    return { vendorId, storeId: String(store._id), canStream: true, isStoreOwner: true };
  }

  const assignment = await StoreManager.findOne({
    storeId: store._id,
    userId: new mongoose.Types.ObjectId(userId),
    role: { $in: STREAM_ROLES },
  })
    .select('_id role')
    .lean();

  if (!assignment) {
    throw new AppError('You do not have permission to stream for this store.', 403);
  }

  return { vendorId, storeId: String(store._id), canStream: true, isStoreOwner: false };
};

export const resolveLivestreamHostUser = (
  userId: string,
  vendorId: string,
  hostUserId?: string | null,
): boolean => userId === vendorId || (hostUserId ? userId === hostUserId : false);

export const listAccessibleStoreIds = async (
  userId: string,
  role?: string,
): Promise<string[]> => {
  const normalizedRole = role?.toLowerCase() ?? '';
  if (
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'admin_l1'
  ) {
    const stores = await VendorStore.find({ status: 'active' }).select('_id').lean();
    return stores.map((store) => String(store._id));
  }

  const userObjectId = toObjectId(userId);
  const [ownedStores, managedStores] = await Promise.all([
    VendorStore.find({ vendorId: userObjectId, status: 'active' }).select('_id').lean(),
    StoreManager.find({ userId: userObjectId }).select('storeId').lean(),
  ]);

  const ids = new Set<string>([
    ...ownedStores.map((store) => String(store._id)),
    ...managedStores.map((entry) => String(entry.storeId)),
  ]);

  return [...ids];
};
