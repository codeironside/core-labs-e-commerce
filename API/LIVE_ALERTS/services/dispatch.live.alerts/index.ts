import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { publishNotificationDispatch } from '../../../../CORE/services/kafka/index.js';
import { User } from '../../../AUTH/models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { VendorStore } from '../../../STORES/models/index.js';
import { LiveAlertSubscription } from '../../models/index.js';

type DispatchLiveAlertsInput = {
  vendorId: string;
  storeId?: string | undefined;
  livestreamId: string;
  title: string;
  hostUserId: string;
  listedProductIds?: string[] | undefined;
};

export const dispatchLiveAlerts = async (input: DispatchLiveAlertsInput): Promise<void> => {
  const targetFilters: Array<Record<string, unknown>> = [
    { targetType: 'vendor', targetId: new mongoose.Types.ObjectId(input.vendorId) },
  ];

  if (input.storeId) {
    targetFilters.push({
      targetType: 'store',
      targetId: new mongoose.Types.ObjectId(input.storeId),
    });
  }

  if (input.listedProductIds && input.listedProductIds.length > 0) {
    const productObjectIds = input.listedProductIds
      .filter((productId) => mongoose.isValidObjectId(productId))
      .map((productId) => new mongoose.Types.ObjectId(productId));
    if (productObjectIds.length > 0) {
      targetFilters.push({
        targetType: 'product',
        targetId: { $in: productObjectIds },
      });
    }
  }

  const subscriptions = await LiveAlertSubscription.find({
    $or: targetFilters,
    userId: { $ne: new mongoose.Types.ObjectId(input.hostUserId) },
  })
    .select('userId targetType targetId channels contactPhone')
    .lean();

  if (subscriptions.length === 0) {
    return;
  }

  const [vendor, store] = await Promise.all([
    User.findById(input.vendorId).select('name email').lean(),
    input.storeId
      ? VendorStore.findById(input.storeId).select('name').lean()
      : Promise.resolve(null),
  ]);

  const vendorName = vendor?.name ?? 'Vendor';
  const storeName = store?.name;
  const alertTitle = storeName
    ? `${storeName} is live now`
    : `${vendorName} is live on E-Market`;
  const alertBody = storeName
    ? `${vendorName} started a livestream from ${storeName}: "${input.title}". Tap to watch.`
    : `${vendorName} just went live: "${input.title}". Tap to watch.`;

  const productIds = new Set(
    (input.listedProductIds ?? []).filter((productId) => mongoose.isValidObjectId(productId)),
  );
  const productNameMap = productIds.size > 0
    ? new Map(
        (
          await Product.find({ _id: { $in: [...productIds].map((id) => new mongoose.Types.ObjectId(id)) } })
            .select('_id name')
            .lean()
        ).map((product) => [String(product._id), product.name]),
      )
    : new Map<string, string>();

  const subscriberIds = [...new Set(subscriptions.map((entry) => String(entry.userId)))];
  const subscriberProfiles = await User.find({ _id: { $in: subscriberIds } })
    .select('_id email phone')
    .lean();
  const profileMap = new Map(subscriberProfiles.map((profile) => [String(profile._id), profile]));

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const userId = String(subscription.userId);
      const profile = profileMap.get(userId);
      const phone =
        subscription.contactPhone
        ?? (profile as { phone?: string } | undefined)?.phone
        ?? undefined;

      const isProductAlert = subscription.targetType === 'product';
      const productName = isProductAlert
        ? productNameMap.get(String(subscription.targetId)) ?? 'A product'
        : undefined;
      const title = isProductAlert
        ? `${productName} is live now`
        : alertTitle;
      const body = isProductAlert
        ? `${vendorName} is featuring ${productName} on a livestream: "${input.title}". Tap to watch and buy.`
        : alertBody;

      await publishNotificationDispatch({
        userId,
        category: 'live',
        title,
        body,
        accent: 'info',
        channels: subscription.channels,
        delivery: {
          ...(profile?.email ? { email: profile.email } : {}),
          ...(phone ? { phone } : {}),
        },
        metadata: {
          livestreamId: input.livestreamId,
          vendorId: input.vendorId,
          ...(input.storeId ? { storeId: input.storeId } : {}),
          targetType: subscription.targetType,
          targetId: String(subscription.targetId),
        },
      });
    }),
  );

  logger.info(
    {
      livestreamId: input.livestreamId,
      vendorId: input.vendorId,
      storeId: input.storeId,
      subscriberCount: subscriptions.length,
    },
    'Live alert notifications dispatched',
  );
};
