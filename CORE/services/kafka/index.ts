import { Kafka, type Producer, type ProducerRecord } from 'kafkajs';
import { Partitioners } from 'kafkajs';
import { buildKafkaClientConfig } from '../../../../KAFKA/buildClientConfig.js';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
import type { KafkaTopic } from '../../constants/kafka/index.js';

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

export const connectKafkaProducer = async (): Promise<void> => {
  if (connected && producer) {
    return;
  }

  producer = createProducer();
  await producer.connect();
  connected = true;
  logger.info({ brokers: config.kafka.brokers }, 'Kafka producer connected');
};

export const disconnectKafkaProducer = async (): Promise<void> => {
  if (!producer || !connected) {
    return;
  }

  await producer.disconnect();
  producer = null;
  connected = false;
  logger.info('Kafka producer disconnected');
};

export const publishKafkaEvent = async <T extends Record<string, unknown>>(
  topic: KafkaTopic,
  payload: T,
  key?: string,
): Promise<void> => {
  if (!config.kafka.enabled) {
    return;
  }

  if (!producer || !connected) {
    logger.warn({ topic }, 'Kafka producer not connected — skipping event publish');
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
          service: config.serviceName,
        }),
      },
    ],
  };

  try {
    await producer.send(record);
    logger.info({ topic, key }, 'Kafka event published');
  } catch (error) {
    logger.error({ error, topic, key }, 'Kafka event publish failed');
  }
};
