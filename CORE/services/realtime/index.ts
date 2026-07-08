import { redisClient } from '../cache/index.js';
import { logger } from '../logger/index.js';

export type LivestreamRealtimeEvent =
  | { type: 'viewer.joined'; livestreamId: string; userId: string; joinedAt: string }
  | {
      type: 'comment.created';
      livestreamId: string;
      commentId: string;
      userId: string;
      message: string;
      createdAt: string;
      isGuest?: boolean;
      authorName?: string;
      authorAvatar?: string;
    }
  | {
      type: 'bid.placed';
      livestreamId: string;
      auctionId: string;
      bidderId: string;
      amount: number;
      previousBidAmount?: number;
      endsAt?: string;
      createdAt: string;
    }
  | {
      type: 'auction.created';
      livestreamId: string;
      auctionId: string;
      productId: string;
      productName?: string;
      startingBid?: number;
      minimumIncrement?: number;
      bidInactivitySeconds?: number;
      endsAt?: string;
      createdAt: string;
    }
  | {
      type: 'auction.closed';
      livestreamId: string;
      auctionId: string;
      productId: string;
      productName?: string;
      closedAt: string;
      noBids?: boolean;
      winnerUserId?: string;
      winningAmount?: number;
      winningOrderId?: string;
    }
  | {
      type: 'auction.order_ready';
      livestreamId: string;
      auctionId: string;
      productId: string;
      productName?: string;
      closedAt: string;
      winnerUserId: string;
      winningAmount: number;
      winningOrderId: string;
    }
  | {
      type: 'livestream.products-updated';
      livestreamId: string;
      products: unknown[];
      openAuctionProductIds: string[];
    }
  | { type: 'livestream.status'; livestreamId: string; channelName: string; status: string; updatedAt: string }
  | { type: 'livestream.ended'; livestreamId: string; endedAt: string; status?: 'ended' | 'cancelled' }
  | { type: 'viewer.count'; livestreamId: string; viewerCount: number };

const channelForLivestream = (livestreamId: string): string => `livestream:${livestreamId}:events`;

export const publishLivestreamEvent = async (
  livestreamId: string,
  event: LivestreamRealtimeEvent,
): Promise<void> => {
  try {
    await redisClient.publish(channelForLivestream(livestreamId), JSON.stringify(event));
  } catch (error) {
    logger.error({ error, livestreamId, eventType: event.type }, 'Failed to publish realtime event');
  }
};

export const createLivestreamSubscriber = async (
  livestreamId: string,
  onMessage: (event: LivestreamRealtimeEvent) => Promise<void>,
): Promise<() => Promise<void>> => {
  const subscriber = redisClient.duplicate();
  const channel = channelForLivestream(livestreamId);

  const handler = async (_channel: string, payload: string): Promise<void> => {
    try {
      await onMessage(JSON.parse(payload) as LivestreamRealtimeEvent);
    } catch (error) {
      logger.error({ error, livestreamId }, 'Failed to process realtime event payload');
    }
  };

  subscriber.on('message', handler);
  await subscriber.subscribe(channel);

  return async () => {
    subscriber.off('message', handler);
    await subscriber.unsubscribe(channel);
    subscriber.disconnect();
  };
};
