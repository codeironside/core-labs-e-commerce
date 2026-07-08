import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { publishNotificationDispatch } from '../../../../CORE/services/kafka/index.js';
import { User } from '../../../AUTH/models/index.js';
import { LiveAlertSubscription } from '../../models/index.js';
import { resolveVendorInteractorUserIds } from '../../utils/resolveVendorInteractors.js';

type DispatchAuctionStartedAlertsInput = {
  vendorId: string;
  livestreamId: string;
  auctionId: string;
  productId: string;
  productName: string;
  startingBid: number;
  hostUserId: string;
};

export const dispatchAuctionStartedAlerts = async (
  input: DispatchAuctionStartedAlertsInput,
): Promise<void> => {
  const [interactorIds, vendorSubscriptions, productSubscriptions] = await Promise.all([
    resolveVendorInteractorUserIds(input.vendorId, input.hostUserId),
    LiveAlertSubscription.find({
      targetType: 'vendor',
      targetId: new mongoose.Types.ObjectId(input.vendorId),
      userId: { $ne: new mongoose.Types.ObjectId(input.hostUserId) },
    })
      .select('userId channels contactPhone')
      .lean(),
    LiveAlertSubscription.find({
      targetType: 'product',
      targetId: new mongoose.Types.ObjectId(input.productId),
      userId: { $ne: new mongoose.Types.ObjectId(input.hostUserId) },
    })
      .select('userId channels contactPhone')
      .lean(),
  ]);

  const subscriberMap = new Map<string, (typeof vendorSubscriptions)[number]>();
  vendorSubscriptions.forEach((entry) => subscriberMap.set(String(entry.userId), entry));
  productSubscriptions.forEach((entry) => {
    if (!subscriberMap.has(String(entry.userId))) {
      subscriberMap.set(String(entry.userId), entry);
    }
  });

  const recipientIds = new Set<string>([
    ...interactorIds,
    ...vendorSubscriptions.map((entry) => String(entry.userId)),
    ...productSubscriptions.map((entry) => String(entry.userId)),
  ]);

  if (recipientIds.size === 0) {
    return;
  }

  const vendor = await User.findById(input.vendorId).select('name email').lean();
  const vendorName = vendor?.name ?? 'Vendor';
  const alertTitle = `Auction started on ${vendorName}'s live`;
  const alertBody = `${productNameLabel(input.productName)} is up for auction starting at ₦${input.startingBid.toLocaleString()}. Join the stream to bid.`;

  const profiles = await User.find({ _id: { $in: [...recipientIds] } })
    .select('_id email phone')
    .lean();
  const profileMap = new Map(profiles.map((profile) => [String(profile._id), profile]));

  await Promise.all(
    [...recipientIds].map(async (userId) => {
      const subscription = subscriberMap.get(userId);
      const profile = profileMap.get(userId);
      const phone =
        subscription?.contactPhone
        ?? (profile as { phone?: string } | undefined)?.phone
        ?? undefined;

      const channels = subscription?.channels ?? { inApp: true, email: false, whatsapp: false, sms: false };

      await publishNotificationDispatch({
        userId,
        category: 'auctions',
        title: alertTitle,
        body: alertBody,
        accent: 'warning',
        channels: subscription ? channels : { inApp: true, email: false, whatsapp: false, sms: false },
        delivery: {
          ...(profile?.email ? { email: profile.email } : {}),
          ...(phone ? { phone } : {}),
        },
        metadata: {
          livestreamId: input.livestreamId,
          auctionId: input.auctionId,
          productId: input.productId,
          vendorId: input.vendorId,
          startingBid: String(input.startingBid),
        },
      });
    }),
  );

  logger.info(
    {
      auctionId: input.auctionId,
      livestreamId: input.livestreamId,
      vendorId: input.vendorId,
      interactorCount: interactorIds.length,
      subscriberCount: vendorSubscriptions.length + productSubscriptions.length,
      recipientCount: recipientIds.size,
    },
    'Auction started notifications dispatched',
  );
};

const productNameLabel = (productName: string): string => productName.trim() || 'A product';
