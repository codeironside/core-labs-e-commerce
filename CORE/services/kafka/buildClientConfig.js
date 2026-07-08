export const buildKafkaClientConfig = (settings) => {
    const kafkaConfig = {
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
