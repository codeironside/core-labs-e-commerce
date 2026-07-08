import { Kafka } from 'kafkajs';
import { Partitioners } from 'kafkajs';
import { buildKafkaClientConfig } from './buildClientConfig.js';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
let producer = null;
let connected = false;
const createProducer = () => {
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
export const connectKafkaProducer = async () => {
    if (connected && producer) {
        return;
    }
    producer = createProducer();
    await producer.connect();
    connected = true;
    logger.info({ brokers: config.kafka.brokers }, 'Kafka producer connected');
};
export const disconnectKafkaProducer = async () => {
    if (!producer || !connected) {
        return;
    }
    await producer.disconnect();
    producer = null;
    connected = false;
    logger.info('Kafka producer disconnected');
};
export const publishKafkaEvent = async (topic, payload, key) => {
    if (!config.kafka.enabled) {
        return;
    }
    if (!producer || !connected) {
        logger.warn({ topic }, 'Kafka producer not connected — skipping event publish');
        return;
    }
    const record = {
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
    }
    catch (error) {
        logger.error({ error, topic, key }, 'Kafka event publish failed');
    }
};
