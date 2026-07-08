import { Kafka, type Producer, type ProducerRecord } from 'kafkajs';
import { Partitioners } from 'kafkajs';
import { buildKafkaClientConfig } from '../../../../KAFKA/buildClientConfig.js';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';
import {
  COMMERCE_KAFKA_TOPICS,
  type CommerceKafkaTopic,
  type NotificationDispatchPayload,
  type AuctionWinnerOrderPayload,
} from '../../constants/kafka/index.js';

let producer: Producer | null = null;
let connected = false;

const createProducer = (): Producer => {
  const kafka = new Kafka(buildKafkaClientConfig({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    saslUsername: config.kafka.saslUsername,
    saslPassword: config.kafka.saslPassword,
    ssl: config.kafka.ssl,
  }));

  return kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  });
};

const KAFKA_CONNECT_TIMEOUT_MS = 5000;

export const connectKafkaProducer = async (): Promise<void> => {
  if (!config.kafka.enabled || connected) return;

  producer = createProducer();
  try {
    await Promise.race([
      producer.connect(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('Kafka connect timeout')), KAFKA_CONNECT_TIMEOUT_MS);
      }),
    ]);
    connected = true;
    logger.info({ brokers: config.kafka.brokers }, 'E-commerce Kafka producer connected');
  } catch (error) {
    producer = null;
    connected = false;
    logger.warn({ error, brokers: config.kafka.brokers }, 'Kafka unavailable — continuing without producer');
  }
};

export const disconnectKafkaProducer = async (): Promise<void> => {
  if (!producer || !connected) return;
  await producer.disconnect();
  producer = null;
  connected = false;
};

export const publishCommerceEvent = async <T extends Record<string, unknown>>(
  topic: CommerceKafkaTopic,
  payload: T,
  key?: string,
): Promise<void> => {
  if (!config.kafka.enabled || !producer || !connected) {
    logger.warn({ topic }, 'Kafka producer unavailable — skipping commerce event');
    return;
  }

  const record: ProducerRecord = {
    topic,
    messages: [
      {
        ...(key ? { key } : {}),
        value: JSON.stringify({
          ...payload,
          emittedAt: new Date().toISOString(),
          service: 'e-commerce-service',
        }),
      },
    ],
  };

  try {
    await producer.send(record);
    logger.info({ topic, key }, 'Commerce Kafka event published');
  } catch (error) {
    logger.error({ error, topic, key }, 'Commerce Kafka event publish failed');
  }
};

export const publishNotificationDispatch = async (
  payload: NotificationDispatchPayload,
): Promise<void> => {
  await publishCommerceEvent(COMMERCE_KAFKA_TOPICS.NOTIFICATION_DISPATCH, payload, payload.userId);
};

export const publishAuctionWinnerOrderCommand = async (
  payload: AuctionWinnerOrderPayload,
): Promise<void> => {
  await publishCommerceEvent(
    COMMERCE_KAFKA_TOPICS.FINANCE_ORDER_AUCTION_WINNER,
    payload,
    payload.auctionId,
  );
};
