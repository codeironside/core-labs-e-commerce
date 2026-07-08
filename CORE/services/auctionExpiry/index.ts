import { logger } from '../logger/index.js';
import { LivestreamAuction } from '../../../API/LIVESTREAMS/models/index.js';
import { closeLivestreamAuction } from '../../../API/LIVESTREAMS/utils/closeAuction.js';

const EXPIRY_POLL_INTERVAL_MS = 5000;

let expiryTimer: ReturnType<typeof setInterval> | null = null;

const processExpiredAuctions = async (): Promise<void> => {
  const now = new Date();
  const expiredAuctions = await LivestreamAuction.find({
    status: 'open',
    endsAt: { $lte: now },
  })
    .select('_id')
    .limit(25)
    .lean();

  await Promise.all(
    expiredAuctions.map(async ({ _id }) => {
      try {
        await closeLivestreamAuction({ auctionId: String(_id) });
      } catch (error) {
        logger.warn({ error, auctionId: String(_id) }, 'Failed to auto-close expired auction');
      }
    }),
  );
};

export const startAuctionExpiryScheduler = (): void => {
  if (expiryTimer) return;
  expiryTimer = setInterval(() => {
    void processExpiredAuctions();
  }, EXPIRY_POLL_INTERVAL_MS);
  logger.info({ intervalMs: EXPIRY_POLL_INTERVAL_MS }, 'Auction expiry scheduler started');
};

export const stopAuctionExpiryScheduler = (): void => {
  if (!expiryTimer) return;
  clearInterval(expiryTimer);
  expiryTimer = null;
};
