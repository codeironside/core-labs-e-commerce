import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { Product } from '../../models/index.js';
import { fetchProductsQuerySchema } from '../../schemas/index.js';
import { serializeProducts } from '../../utils/index.js';

export const fetchProductsController = async (c: Context) => {
    try {
        const parsed = fetchProductsQuerySchema.safeParse(c.req.query());

        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
                400,
            );
        }

        const { page, limit, search, category, subcategory, vendorId } = parsed.data;
        const filter: Record<string, unknown> = { status: 'active' };

        if (search) {
            filter.$text = { $search: search };
        }

        if (category) filter.category = category;
        if (subcategory) filter.subcategory = subcategory;
        if (vendorId) filter.vendorId = vendorId;

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
                .select(search ? { score: { $meta: 'textScore' } } : {})
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(filter),
        ]);

        logger.info({ page, limit, total }, 'Public products fetched');

        return ResponseHandler.success(
            c,
            SYSTEM_MESSAGES.SUCCESS.PRODUCTS_FETCHED,
            { products: serializeProducts(products) },
            {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to fetch products');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCTS_FETCH_FAILED, 500);
    }
};
