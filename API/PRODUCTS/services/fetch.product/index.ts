import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { Product } from '../../models/index.js';
import { buildProductLookup, serializeProduct } from '../../utils/index.js';

export const fetchProductController = async (c: Context) => {
    try {
        const identifier = c.req.param('identifier');
        if (!identifier) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
        }

        const product = await Product.findOne({
            ...buildProductLookup(identifier),
            status: 'active',
        }).lean();

        if (!product) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
        }

        logger.info({ identifier, productId: product._id }, 'Public product fetched');

        return ResponseHandler.success(
            c,
            SYSTEM_MESSAGES.SUCCESS.PRODUCT_FETCHED,
            { product: serializeProduct(product) },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to fetch product');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_FETCH_FAILED, 500);
    }
};
