import { AppError } from '../../../CORE/handlers/error/index.js';
import { broadcastLivestreamEvent } from '../../../CORE/services/livestreamBroadcast/index.js';
import { publishAuctionWinnerOrderCommand } from '../../../CORE/services/kafka/index.js';
import { SYSTEM_MESSAGES } from '../../../CORE/utils/constants/index.js';
import { LivestreamAuction, LivestreamBid, type ILivestreamAuctionDocument } from '../models/index.js';
import { broadcastLivestreamProducts } from './livestreamProducts.js';
import { recordHighlightMoment } from './highlightMoments.js';
import { Product } from '../../PRODUCTS/models/index.js';

export type CloseLivestreamAuctionResult = {
  auction: ILivestreamAuctionDocument;
  winningOrderId: string | null;
  noBids: boolean;
};

export const closeLivestreamAuction = async (input: {
  auctionId: string;
  vendorId?: string;
}): Promise<CloseLivestreamAuctionResult> => {
  const filter: Record<string, unknown> = {
    _id: input.auctionId,
    status: 'open',
  };
  if (input.vendorId) {
    filter.vendorId = input.vendorId;
  }

  const auction = await LivestreamAuction.findOne(filter);
  if (!auction) {
    throw new AppError(
      input.vendorId
        ? SYSTEM_MESSAGES.ERRORS.AUCTION_NOT_FOUND
        : SYSTEM_MESSAGES.ERRORS.AUCTION_NOT_OPEN,
      input.vendorId ? 404 : 409,
    );
  }

  const winningBid = await LivestreamBid.findOne({ auctionId: auction._id })
    .sort({ amount: -1, createdAt: 1 })
    .lean();

  const closedAt = new Date();
  const livestreamId = String(auction.livestreamId);
  auction.status = 'closed';
  auction.closedAt = closedAt;

  const noBids = !winningBid;
  let winnerUserId: string | undefined;
  let closedProductName: string | undefined;

  if (winningBid) {
    auction.highestBidAmount = winningBid.amount;
    auction.highestBidderId = winningBid.bidderId as never;
    auction.winnerBidId = winningBid._id as never;
    winnerUserId = String(winningBid.bidderId);

    const product = await Product.findById(auction.productId).select('name').lean();
    closedProductName = product?.name ?? 'Auction item';

    await publishAuctionWinnerOrderCommand({
      buyerId: winnerUserId,
      vendorId: String(auction.vendorId),
      productId: String(auction.productId),
      livestreamId,
      auctionId: String(auction._id),
      winningBidAmount: winningBid.amount,
      ...(closedProductName ? { productName: closedProductName } : {}),
      closedAt: closedAt.toISOString(),
    });

    await recordHighlightMoment({
      livestreamId,
      source: 'auction_won',
      label: `Auction won — ${closedProductName}`,
      onlyWhenActive: true,
    });
  }

  await auction.save();

  await broadcastLivestreamEvent(livestreamId, {
    type: 'auction.closed',
    livestreamId,
    auctionId: String(auction._id),
    productId: String(auction.productId),
    ...(closedProductName ? { productName: closedProductName } : {}),
    closedAt: closedAt.toISOString(),
    noBids,
    ...(winnerUserId ? { winnerUserId } : {}),
    ...(winningBid ? { winningAmount: winningBid.amount } : {}),
  });

  if (noBids) {
    await broadcastLivestreamProducts(livestreamId);
  }

  return { auction, winningOrderId: null, noBids };
};
