import { S3Client } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../config/index.js';

import { logger } from '../logger/index.js';

export const s3Client = config.aws.region && config.aws.accessKeyId && config.aws.secretAccessKey
    ? new S3Client({
        region: config.aws.region,
        credentials: {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
        },
    })
    : null;

if (!s3Client) {
    logger.warn('AWS S3 credentials missing. S3 client not initialized.');
}

if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
    cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
        secure: true,
    });
} else {
    logger.warn('Cloudinary credentials missing. Cloudinary client not initialized.');
}

export { cloudinary };
