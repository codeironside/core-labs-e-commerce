import mongoose from 'mongoose';
import { Order } from '../../ORDERS/models/index.js';
import { LivestreamSession } from '../../LIVESTREAMS/models/index.js';

export type VendorPerformanceMetrics = {
  salesCount: number;
  watchHours: number;
};

export const getVendorPerformanceMetrics = async (vendorId: string): Promise<VendorPerformanceMetrics> => {
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

  const [salesCount, streams] = await Promise.all([
    Order.countDocuments({ vendorId: vendorObjectId, status: 'paid' }),
    LivestreamSession.find({ vendorId: vendorObjectId })
      .select('createdAt endedAt status')
      .lean(),
  ]);

  const watchHours = streams.reduce((total, stream) => {
    if (!stream.endedAt) {
      return total;
    }
    const durationMs = stream.endedAt.getTime() - stream.createdAt.getTime();
    return total + Math.max(0, durationMs / 3_600_000);
  }, 0);

  return {
    salesCount,
    watchHours: Number(watchHours.toFixed(2)),
  };
};

export const vendorMeetsPromoCriteria = (
  metrics: VendorPerformanceMetrics,
  criteria?: { minWatchHours?: number; minSalesCount?: number },
): boolean => {
  if (!criteria) {
    return true;
  }
  if (criteria.minSalesCount !== undefined && metrics.salesCount < criteria.minSalesCount) {
    return false;
  }
  if (criteria.minWatchHours !== undefined && metrics.watchHours < criteria.minWatchHours) {
    return false;
  }
  return true;
};
