import { LivestreamAuction, LivestreamSession } from '../models/index.js';
import { Product } from '../../PRODUCTS/models/index.js';

const PRODUCT_SELECT = '_id name pricing media shortDescription status inventory';

export type LivestreamProductSnapshot = {
  products: Array<Record<string, unknown>>;
  openAuctionProductIds: string[];
};

export const fetchOpenAuctionProductIds = async (livestreamId: string): Promise<string[]> => {
  const now = new Date();
  const openAuctions = await LivestreamAuction.find({
    livestreamId,
    status: 'open',
    endsAt: { $gt: now },
  })
    .select('productId')
    .lean();

  return openAuctions.map((auction) => String(auction.productId));
};

export const fetchLivestreamProductSnapshot = async (
  livestreamId: string,
): Promise<LivestreamProductSnapshot> => {
  const livestream = await LivestreamSession.findById(livestreamId)
    .select('listedProductIds')
    .lean();

  const listedIds = livestream?.listedProductIds ?? [];
  const [products, openAuctionProductIds] = await Promise.all([
    listedIds.length > 0
      ? Product.find({ _id: { $in: listedIds } }).select(PRODUCT_SELECT).lean()
      : Promise.resolve([]),
    fetchOpenAuctionProductIds(livestreamId),
  ]);

  return {
    products: products as Array<Record<string, unknown>>,
    openAuctionProductIds,
  };
};

export const broadcastLivestreamProducts = async (livestreamId: string): Promise<void> => {
  const { broadcastLivestreamEvent } = await import(
    '../../../CORE/services/livestreamBroadcast/index.js'
  );
  const snapshot = await fetchLivestreamProductSnapshot(livestreamId);
  await broadcastLivestreamEvent(livestreamId, {
    type: 'livestream.products-updated',
    livestreamId,
    products: snapshot.products,
    openAuctionProductIds: snapshot.openAuctionProductIds,
  });
};
