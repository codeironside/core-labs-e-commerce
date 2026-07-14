import type { KafkaConfig } from 'kafkajs';

export type KafkaConnectionSettings = {
  brokers: string[];
  clientId: string;
  saslUsername?: string | undefined;
  saslPassword?: string | undefined;
  ssl?: boolean | undefined;
};

export const buildKafkaClientConfig = (settings: KafkaConnectionSettings): KafkaConfig => {
  const kafkaConfig: KafkaConfig = {
    clientId: settings.clientId,
    brokers: settings.brokers,
  };

  if (settings.saslUsername && settings.saslPassword) {
    kafkaConfig.ssl = settings.ssl ?? true;
    kafkaConfig.sasl = {
      mechanism: 'plain',
      username: settings.saslUsername,
      password: settings.saslPassword,
    };
  }

  return kafkaConfig;
};
