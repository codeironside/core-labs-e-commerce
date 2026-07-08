import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);
let circuitState = 'CLOSED';
let failureCount = 0;
const defaultMigrations = [];
export const registerDbMigration = (hook) => {
    defaultMigrations.push(hook);
};
async function runMigrations(connection) {
    for (const hook of defaultMigrations) {
        await hook(connection);
    }
}
async function attemptConnection(attempt) {
    try {
        mongoose.connection.on('connected', () => {
            logger.info('[platform-core] MongoDB connected');
        });
        mongoose.connection.on('error', (err) => {
            logger.error({ err }, 'MongoDB connection error');
        });
        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });
        await mongoose.connect(config.db.uri, {
            maxPoolSize: config.db.maxPoolSize,
            autoIndex: config.env !== 'production',
        });
        await runMigrations(mongoose.connection);
        circuitState = 'CLOSED';
        failureCount = 0;
        logger.info({ attempt }, 'MongoDB connected');
    }
    catch (error) {
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
export async function connectDatabase() {
    if (circuitState === 'OPEN') {
        throw new Error('Database circuit breaker is OPEN');
    }
    await attemptConnection(0);
}
/** @deprecated Use connectDatabase — kept for Flamigo compatibility */
export const connectDB = connectDatabase;
export async function disconnectDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected');
    }
}
export function getConnection() {
    if (mongoose.connection.readyState === 0) {
        throw new Error('MongoDB client not initialized');
    }
    return mongoose.connection;
}
