import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import mongoose from 'mongoose';
import { LivestreamAuction, LivestreamBid, LivestreamSession } from '../../models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';

const resolvePreviousBidAmount = (
  topBids: number[],
  startingBid: number,
): number | undefined => {
  if (topBids.length >= 2) return topBids[1];
  if (topBids.length === 1) return startingBid;
  return undefined;
};

const mapOpenAuction = (auction: {
  _id: unknown;
  livestreamId: unknown;
  productId: unknown;
  status: string;
  startingBid: number;
  minimumIncrement: number;
  highestBidAmount?: number;
  highestBidderId?: unknown;
  bidInactivitySeconds?: number;
  endsAt: Date;
  createdAt?: Date;
}, productName: string, previousBidAmount?: number) => ({
  _id: String(auction._id),
  livestreamId: String(auction.livestreamId),
  productId: String(auction.productId),
  productName,
  status: auction.status,
  startingBid: auction.startingBid,
  minimumIncrement: auction.minimumIncrement,
  highestBidAmount: auction.highestBidAmount,
  highestBidderId: auction.highestBidderId ? String(auction.highestBidderId) : undefined,
  previousBidAmount,
  bidInactivitySeconds: auction.bidInactivitySeconds,
  endsAt: auction.endsAt.toISOString(),
});

export const fetchOpenAuctionsController = async (c: Context) => {
  try {
    const livestreamId = c.req.param('livestreamId');
    if (!livestreamId) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

    const livestream = await LivestreamSession.findById(livestreamId).select('_id').lean();
    if (!livestream) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

    const auctions = await LivestreamAuction.find({
      livestreamId,
      status: 'open',
      endsAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();

    const productIds = [...new Set(auctions.map((auction) => String(auction.productId)))];
    const auctionIds = auctions.map((auction) => auction._id);

    const [products, bidRankings] = await Promise.all([
      productIds.length
        ? Product.find({ _id: { $in: productIds } }).select('_id name').lean()
        : Promise.resolve([]),
      auctionIds.length
        ? LivestreamBid.aggregate<{ _id: mongoose.Types.ObjectId; bids: number[] }>([
            { $match: { auctionId: { $in: auctionIds } } },
            { $sort: { amount: -1, createdAt: -1 } },
            {
              $group: {
                _id: '$auctionId',
                bids: { $push: '$amount' },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const productNameById = new Map(products.map((product) => [String(product._id), product.name]));
    const bidsByAuctionId = new Map(
      bidRankings.map((row) => [String(row._id), row.bids.slice(0, 2)]),
    );

    const enrichedAuctions = auctions.map((auction) =>
      mapOpenAuction(
        auction,
        productNameById.get(String(auction.productId)) ?? 'Product',
        resolvePreviousBidAmount(
          bidsByAuctionId.get(String(auction._id)) ?? [],
          auction.startingBid,
        ),
      ),
    );

    return ResponseHandler.success(c, 'Open auctions fetched.', { auctions: enrichedAuctions });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch open auctions');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
  }
};
