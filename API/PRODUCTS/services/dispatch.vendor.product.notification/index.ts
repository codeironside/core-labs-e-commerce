import { logger } from '../../../../CORE/services/logger/index.js';
import { publishNotificationDispatch } from '../../../../CORE/services/kafka/index.js';
import { User } from '../../../AUTH/models/index.js';
import { StoreManager } from '../../../STORES/models/index.js';
import mongoose from 'mongoose';

type ProductStatus = 'draft' | 'active' | 'archived';

type DispatchVendorProductNotificationInput = {
  vendorId: string;
  productId: string;
  productName: string;
  status: ProductStatus;
  storeId?: string;
};

async function notifyUser(input: {
  userId: string;
  title: string;
  body: string;
  accent: 'success' | 'info';
  email?: string | undefined;
  metadata: Record<string, string>;
}): Promise<void> {
  await publishNotificationDispatch({
    userId: input.userId,
    category: 'all',
    title: input.title,
    body: input.body,
    accent: input.accent,
    channels: {
      inApp: true,
      push: true,
      email: Boolean(input.email),
    },
    delivery: input.email ? { email: input.email } : {},
    metadata: input.metadata,
  });
}

export const dispatchVendorProductNotification = async (
  input: DispatchVendorProductNotificationInput,
): Promise<void> => {
  const vendor = await User.findById(input.vendorId).select('email name').lean();
  const vendorEmail = vendor?.email?.trim() || undefined;

  const isPublished = input.status === 'active';
  const title = isPublished ? 'Product published' : 'Product saved as draft';
  const body = isPublished
    ? `"${input.productName}" is now live on your storefront. Buyers can find it during live shows and browse.`
    : `"${input.productName}" was saved as a draft. Publish it to your store when you are ready.`;

  const metadata = {
    productId: input.productId,
    productName: input.productName,
    status: input.status,
    ...(input.storeId ? { storeId: input.storeId } : {}),
    eventType: 'vendor_product_created',
  };

  await notifyUser({
    userId: input.vendorId,
    title,
    body,
    accent: isPublished ? 'success' : 'info',
    ...(vendorEmail !== undefined ? { email: vendorEmail } : {}),
    metadata,
  });

  if (input.storeId) {
    const managers = await StoreManager.find({
      storeId: new mongoose.Types.ObjectId(input.storeId),
      role: 'manager',
    })
      .select('userId')
      .lean();

    const managerIds = managers
      .map((entry) => String(entry.userId))
      .filter((managerId) => managerId !== input.vendorId);

    if (managerIds.length > 0) {
      const managerUsers = await User.find({ _id: { $in: managerIds } })
        .select('_id email')
        .lean();
      const managerEmailMap = new Map(
        managerUsers.map((user) => [String(user._id), user.email?.trim() || undefined]),
      );

      await Promise.all(
        managerIds.map((managerId) => {
          const managerEmail = managerEmailMap.get(managerId);
          return notifyUser({
            userId: managerId,
            title: isPublished ? 'New product on your store' : 'Draft product added',
            body: isPublished
              ? `"${input.productName}" was published to a storefront you manage.`
              : `"${input.productName}" was saved as a draft on a storefront you manage.`,
            accent: isPublished ? 'success' : 'info',
            ...(managerEmail !== undefined ? { email: managerEmail } : {}),
            metadata: { ...metadata, eventType: 'store_manager_product_created' },
          });
        }),
      );
    }
  }

  logger.info(
    { vendorId: input.vendorId, productId: input.productId, status: input.status, storeId: input.storeId },
    '[Products] Vendor product notification dispatched',
  );
};
