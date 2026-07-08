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

export const fetchVendorStoresController = async (context: Context) => {
  try {
    const sessionUser = context.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const userId = resolveSessionUserId(context);
    const sessionRole = String(sessionUser.role ?? '');
    const accessibleStoreIds = await listAccessibleStoreIds(userId, sessionRole);

    if (accessibleStoreIds.length === 0) {
      return ResponseHandler.success(context, 'Stores fetched successfully.', { stores: [] });
    }

    const stores = await VendorStore.find({
      _id: { $in: accessibleStoreIds.map((id) => new mongoose.Types.ObjectId(id)) },
      status: 'active',
    })
      .select('_id vendorId name slug description logoUrl coverImageUrl address location googlePlaceId isDefault createdAt updatedAt')
      .sort({ isDefault: -1, updatedAt: -1 })
      .lean();

    const storeObjectIds = stores.map((store) => store._id);
    const [managers, productCounts, activeStreams] = await Promise.all([
      StoreManager.find({ storeId: { $in: storeObjectIds } })
        .select('_id storeId userId role createdAt')
        .lean(),
      Product.aggregate<{ _id: unknown; activeCount: number; assignedCount: number }>([
        { $match: { storeId: { $in: storeObjectIds }, status: { $ne: 'archived' } } },
        {
          $group: {
            _id: '$storeId',
            assignedCount: { $sum: 1 },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
          },
        },
      ]),
      LivestreamSession.find({ storeId: { $in: storeObjectIds }, status: 'active' })
        .select('_id storeId title')
        .lean(),
    ]);

    const productCountMap = new Map(
      productCounts.map((row) => [String(row._id), row.activeCount]),
    );
    const assignedCountMap = new Map(
      productCounts.map((row) => [String(row._id), row.assignedCount]),
    );
    const activeStreamMap = new Map(activeStreams.map((stream) => [String(stream.storeId), stream]));

    const managerUserIds = [...new Set(managers.map((entry) => String(entry.userId)))];
    const managerUsers = managerUserIds.length
      ? await User.find({ _id: { $in: managerUserIds } }).select('_id name email').lean()
      : [];
    const managerUserMap = new Map(
      managerUsers.map((user) => [String(user._id), { name: user.name, email: user.email }]),
    );

    const managersByStore = new Map<string, Array<Record<string, unknown>>>();
    managers.forEach((entry) => {
      const key = String(entry.storeId);
      const bucket = managersByStore.get(key) ?? [];
      const profile = managerUserMap.get(String(entry.userId));
      bucket.push({
        id: String(entry._id),
        userId: String(entry.userId),
        role: entry.role,
        name: profile?.name ?? 'User',
        email: profile?.email ?? '',
        createdAt: entry.createdAt,
      });
      managersByStore.set(key, bucket);
    });

    const enriched = stores.map((store) => {
      const storeKey = String(store._id);
      const activeLivestream = activeStreamMap.get(storeKey);
      return {
        id: storeKey,
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
        isDefault: store.isDefault,
        isOwner: String(store.vendorId) === userId,
        productCount: productCountMap.get(storeKey) ?? 0,
        assignedProductCount: assignedCountMap.get(storeKey) ?? 0,
        managerCount: (managersByStore.get(storeKey) ?? []).length,
        activeLivestream: activeLivestream
          ? { id: String(activeLivestream._id), title: activeLivestream.title }
          : null,
        managers: managersByStore.get(storeKey) ?? [],
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      };
    });

    logger.info({ userId, count: enriched.length }, 'Vendor stores fetched');

    return ResponseHandler.success(context, 'Stores fetched successfully.', { stores: enriched });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch vendor stores');
    throw new AppError('Failed to fetch stores.', 500);
  }
};
