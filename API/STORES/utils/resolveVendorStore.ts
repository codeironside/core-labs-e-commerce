import mongoose from 'mongoose';
import { AppError } from '../../../CORE/handlers/error/index.js';
import { VendorStore } from '../models/index.js';

export const serializeVendorStore = (store: {
  _id: unknown;
  vendorId: unknown;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  address?: {
    formattedAddress?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } | null;
  location?: { lat?: number; lng?: number } | null;
  googlePlaceId?: string | null;
  isDefault?: boolean;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) => ({
  id: String(store._id),
  vendorId: String(store.vendorId),
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
  isDefault: Boolean(store.isDefault),
  status: store.status ?? 'active',
  createdAt: store.createdAt,
  updatedAt: store.updatedAt,
});

export const resolveVendorOwnedStoreId = async (
  vendorId: string,
  storeId: string,
): Promise<mongoose.Types.ObjectId> => {
  const store = await VendorStore.findOne({
    _id: new mongoose.Types.ObjectId(storeId),
    vendorId: new mongoose.Types.ObjectId(vendorId),
    status: 'active',
  })
    .select('_id')
    .lean();

  if (!store) {
    throw new AppError('Store not found or you do not own this store.', 404);
  }

  return store._id as mongoose.Types.ObjectId;
};

export const resolveDefaultVendorStoreId = async (
  vendorId: string,
): Promise<mongoose.Types.ObjectId | undefined> => {
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
  const store = await VendorStore.findOne({ vendorId: vendorObjectId, status: 'active', isDefault: true })
    .select('_id')
    .lean();

  if (store) {
    return store._id as mongoose.Types.ObjectId;
  }

  const fallback = await VendorStore.findOne({ vendorId: vendorObjectId, status: 'active' })
    .sort({ createdAt: 1 })
    .select('_id')
    .lean();

  return fallback?._id as mongoose.Types.ObjectId | undefined;
};
