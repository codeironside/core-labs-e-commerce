import { Kafka, type Consumer, type EachMessagePayload } from 'kafkajs';
import { z } from 'zod';
import { buildKafkaClientConfig } from './buildClientConfig.js';
import { ensureCommerceKafkaTopics } from './ensureTopics.js';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';
import { COMMERCE_KAFKA_TOPICS } from '../../constants/kafka/index.js';
import { broadcastLivestreamEvent } from '../livestreamBroadcast/index.js';

const readySchema = z.object({
  orderId: z.string().length(24),
  buyerId: z.string().length(24),
  vendorId: z.string().length(24),
  productId: z.string().length(24),
  livestreamId: z.string().length(24),
  auctionId: z.string().length(24),
  winningBidAmount: z.number().positive(),
  productName: z.string().optional(),
  closedAt: z.string(),
});

let consumer: Consumer | null = null;

const handleReadyMessage = async ({ message }: EachMessagePayload): Promise<void> => {
  if (!message.value) return;

  const payload = readySchema.parse(JSON.parse(message.value.toString()));

  await broadcastLivestreamEvent(payload.livestreamId, {
    type: 'auction.order_ready',
    livestreamId: payload.livestreamId,
    auctionId: payload.auctionId,
    productId: payload.productId,
    ...(payload.productName ? { productName: payload.productName } : {}),
    winnerUserId: payload.buyerId,
    winningAmount: payload.winningBidAmount,
    winningOrderId: payload.orderId,
    closedAt: payload.closedAt,
  });
};

export const startCommerceKafkaConsumer = async (): Promise<void> => {
  if (!config.kafka.enabled) {
    logger.warn('[CommerceKafka] Consumer disabled');
    return;
  }

  try {
    await ensureCommerceKafkaTopics([
      COMMERCE_KAFKA_TOPICS.FINANCE_ORDER_AUCTION_WINNER_READY,
      COMMERCE_KAFKA_TOPICS.FINANCE_ORDER_AUCTION_WINNER,
      COMMERCE_KAFKA_TOPICS.NOTIFICATION_DISPATCH,
      COMMERCE_KAFKA_TOPICS.LIVESTREAM_EVENT,
    ]);

    const kafka = new Kafka(buildKafkaClientConfig({
      clientId: `${config.kafka.clientId}-commerce-consumer`,
      brokers: config.kafka.brokers,
      saslUsername: config.kafka.saslUsername,
      saslPassword: config.kafka.saslPassword,
      ssl: config.kafka.ssl,
    }));

    consumer = kafka.consumer({ groupId: `${config.kafka.clientId}-commerce` });
    await consumer.connect();
    await consumer.subscribe({
      topic: COMMERCE_KAFKA_TOPICS.FINANCE_ORDER_AUCTION_WINNER_READY,
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async (payload) => {
        try {
          await handleReadyMessage(payload);
        } catch (error) {
          logger.error({ error }, '[CommerceKafka] Auction order ready handler failed');
        }
      },
    });

    logger.info(
      { topic: COMMERCE_KAFKA_TOPICS.FINANCE_ORDER_AUCTION_WINNER_READY },
      '[CommerceKafka] Consumer started',
    );
  } catch (error) {
    consumer = null;
    logger.warn(
      { error, topic: COMMERCE_KAFKA_TOPICS.FINANCE_ORDER_AUCTION_WINNER_READY },
      '[CommerceKafka] Consumer unavailable — continuing without Kafka consumer',
    );
  }
};

export const stopCommerceKafkaConsumer = async (): Promise<void> => {
  if (!consumer) return;
  await consumer.disconnect();
  consumer = null;
};
