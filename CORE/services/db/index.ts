import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

let circuitState: CircuitState = 'CLOSED';
let failureCount = 0;

export type DbMigrationHook = (connection: mongoose.Connection) => Promise<void>;

const defaultMigrations: DbMigrationHook[] = [];

export const registerDbMigration = (hook: DbMigrationHook): void => {
  defaultMigrations.push(hook);
};

async function runMigrations(connection: mongoose.Connection): Promise<void> {
  for (const hook of defaultMigrations) {
    await hook(connection);
  }
}

async function attemptConnection(attempt: number): Promise<void> {
  try {
    mongoose.connection.on('connected', () => {
      logger.info('[platform-core] MongoDB connected');
    });

    mongoose.connection.on('error', (err: Error) => {
      logger.error({ err }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.set('bufferCommands', false);

    await mongoose.connect(config.db.uri, {
      maxPoolSize: config.db.maxPoolSize,
      autoIndex: config.app.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    await runMigrations(mongoose.connection);

    circuitState = 'CLOSED';
    failureCount = 0;
    logger.info({ attempt }, 'MongoDB connected');
  } catch (error) {
    failureCount += 1;
    logger.error({ attempt, failureCount, error }, 'MongoDB connection failed');

    if (failureCount >= config.db.retryAttempts) {
      circuitState = 'OPEN';
      logger.fatal('MongoDB circuit breaker OPEN — max retries exhausted');
      throw new Error('Database unavailable');
    }

    circuitState = 'HALF_OPEN';
    const delay = config.db.retryDelayMs * Math.pow(2, attempt);
    logger.warn({ delay }, 'MongoDB circuit breaker HALF_OPEN — retrying');
    await new Promise((resolve) => setTimeout(resolve, delay));
    return attemptConnection(attempt + 1);
  }
}

export async function connectDatabase(): Promise<void> {
  if (circuitState === 'OPEN') {
    throw new Error('Database circuit breaker is OPEN');
  }
  await attemptConnection(0);
}
  

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
}

export function getConnection(): mongoose.Connection {
  if (mongoose.connection.readyState === 0) {
    throw new Error('MongoDB client not initialized');
  }
  return mongoose.connection;
}
