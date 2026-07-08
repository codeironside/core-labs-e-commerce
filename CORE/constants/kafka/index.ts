import { config } from "../../config/index.js";

export const API_VERSION = `/api/${config.app.API_VERSION}`;


export const COMMERCE_KAFKA_TOPICS = {
  NOTIFICATION_DISPATCH: 'commerce.notification.dispatch',
  LIVESTREAM_EVENT: 'commerce.livestream.event',
  FINANCE_ORDER_AUCTION_WINNER: 'finance.order.auction_winner',
  FINANCE_ORDER_AUCTION_WINNER_READY: 'finance.order.auction_winner.ready',
} as const;

export type AuctionWinnerOrderPayload = {
  buyerId: string;
  vendorId: string;
  productId: string;
  livestreamId: string;
  auctionId: string;
  winningBidAmount: number;
  productName?: string;
  closedAt: string;
};

export type AuctionWinnerOrderReadyPayload = {
  orderId: string;
  buyerId: string;
  vendorId: string;
  productId: string;
  livestreamId: string;
  auctionId: string;
  winningBidAmount: number;
  productName?: string;
  closedAt: string;
};

export type CommerceKafkaTopic = (typeof COMMERCE_KAFKA_TOPICS)[keyof typeof COMMERCE_KAFKA_TOPICS];

export type NotificationChannelPreferences = {
  inApp?: boolean;
  email?: boolean;
  whatsapp?: boolean;
  sms?: boolean;
  push?: boolean;
};

export type NotificationDeliveryContacts = {
  email?: string;
  phone?: string;
};

export type NotificationDispatchPayload = {
  userId: string;
  category: 'all' | 'auctions' | 'live' | 'orders';
  title: string;
  body: string;
  accent?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  channels?: NotificationChannelPreferences;
  delivery?: NotificationDeliveryContacts;
  metadata?: Record<string, string>;
};
