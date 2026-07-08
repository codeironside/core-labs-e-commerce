import mongoose from 'mongoose';
import {
  LivestreamBid,
  LivestreamComment,
  LivestreamParticipant,
  LivestreamSession,
} from '../../../LIVESTREAMS/models/index.js';
import { Order } from '../../../ORDERS/models/index.js';

export const resolveVendorInteractorUserIds = async (
  vendorId: string,
  excludeUserId: string,
): Promise<string[]> => {
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
  const livestreams = await LivestreamSession.find({ vendorId: vendorObjectId })
    .select('_id')
    .lean();
  const livestreamIds = livestreams.map((session) => session._id);

  if (livestreamIds.length === 0) {
    const buyersOnly = await Order.distinct('buyerId', { vendorId: vendorObjectId });
    return buyersOnly
      .map((buyerId) => String(buyerId))
      .filter((userId) => userId !== excludeUserId && mongoose.isValidObjectId(userId));
  }

  const [participants, bidders, comments, buyers] = await Promise.all([
    LivestreamParticipant.distinct('userId', { livestreamId: { $in: livestreamIds } }),
    LivestreamBid.distinct('bidderId', { livestreamId: { $in: livestreamIds } }),
    LivestreamComment.distinct('userId', { livestreamId: { $in: livestreamIds } }),
    Order.distinct('buyerId', { vendorId: vendorObjectId }),
  ]);

  const userIds = new Set<string>();
  const addUserId = (value: unknown): void => {
    const normalized = String(value);
    if (!normalized || normalized === excludeUserId || !mongoose.isValidObjectId(normalized)) {
      return;
    }
    userIds.add(normalized);
  };

  participants.forEach(addUserId);
  bidders.forEach(addUserId);
  comments.forEach(addUserId);
  buyers.forEach(addUserId);

  return [...userIds];
};
