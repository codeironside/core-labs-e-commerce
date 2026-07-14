import { z } from 'zod';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4001),
  API_VERSION: z.string().default('v1'),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(1),
  FINANCE_URL: z.string().url().default('http://localhost:4004'),
  AGORA_APP_ID: z.string(),
  AGORA_APP_CERTIFICATE: z.string(),
  AGORA_CUSTOMER_ID: z.string().optional().default(''),
  AGORA_CUSTOMER_SECRET: z.string().optional().default(''),
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  CLOUDFLARE_STREAM_API_TOKEN: z.string(),
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  CORS_ORIGINS: z.string().default('*'),
  KAFKA_BROKERS: z.string().default('localhost:9094'),
  KAFKA_CLIENT_ID: z.string().default('e-commerce-service'),
  KAFKA_ENABLED: z.coerce.boolean().default(true),
  KAFKA_SASL_USERNAME: z.string().optional(),
  KAFKA_SASL_PASSWORD: z.string().optional(),
  KAFKA_SSL: z.coerce.boolean().optional(),
  FINANCE_SERVICE_URL: z.string().url().default('http://localhost:4004'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().default(10),
  DB_RETRY_ATTEMPTS: z.coerce.number().default(5),
  DB_RETRY_DELAY_MS: z.coerce.number().default(2000),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  AWS_BUCKET: z.string(),
  AWS_SIGNED_URL_TTL: z.coerce.number().default(3600),
  GRAFANA_LOKI_HOST: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  GRAFANA_LOKI_USER_ID: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  GRAFANA_LOKI_API_TOKEN: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`E-commerce config invalid: ${parsed.error.message}`);
}

const env = parsed.data;

export const config = {
  app: {
    port: env.PORT,
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    corsOrigin: env.CORS_ORIGINS,
    API_VERSION: env.API_VERSION,
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET,
    financeUrl: env.FINANCE_URL,
  },
  db: {
    uri: env.MONGODB_URI,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    retryAttempts: env.DB_RETRY_ATTEMPTS,
    retryDelayMs: env.DB_RETRY_DELAY_MS,
  },
  redis: {
    url: env.REDIS_URL,
  },
  agora: {
    appId: env.AGORA_APP_ID,
    appCertificate: env.AGORA_APP_CERTIFICATE,
    customerId: env.AGORA_CUSTOMER_ID,
    customerSecret: env.AGORA_CUSTOMER_SECRET,
  },
  cloudflare: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    streamApiToken: env.CLOUDFLARE_STREAM_API_TOKEN,
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  },
  kafka: {
    brokers: env.KAFKA_BROKERS.split(',').map((broker) => broker.trim()),
    clientId: env.KAFKA_CLIENT_ID,
    enabled: env.KAFKA_ENABLED,
    saslUsername: env.KAFKA_SASL_USERNAME,
    saslPassword: env.KAFKA_SASL_PASSWORD,
    ssl: env.KAFKA_SSL,
  },
  finance: {
    url: env.FINANCE_SERVICE_URL,
  },
  aws:{
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    bucket: env.AWS_BUCKET,
    signedUrlTtl: env.AWS_SIGNED_URL_TTL,
  },
  grafanaLoki: {
    host: env.GRAFANA_LOKI_HOST,
    userId: env.GRAFANA_LOKI_USER_ID,
    apiToken: env.GRAFANA_LOKI_API_TOKEN,
  },
} as const;
