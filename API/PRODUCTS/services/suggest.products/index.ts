import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { Product } from '../../models/index.js';
import { suggestProductsQuerySchema } from '../../schemas/index.js';
import {
    escapeRegex,
    extractPrimaryMediaUrl,
    serializeProducts,
} from '../../utils/index.js';

export const suggestProductsController = async (c: Context) => {
    try {
        const parsed = suggestProductsQuerySchema.safeParse(c.req.query());

        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
                400,
            );
        }

        const { q, limit } = parsed.data;
        const query = q.trim();
        const prefixRegex = new RegExp(`^${escapeRegex(query)}`, 'i');
        const containsRegex = new RegExp(escapeRegex(query), 'i');

        const products = await Product.find({
            status: 'active',
            $or: [
                { name: prefixRegex },
                { brand: prefixRegex },
                { category: prefixRegex },
                { subcategory: prefixRegex },
                { tags: prefixRegex },
                { name: containsRegex },
                { brand: containsRegex },
            ],
        })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean();

        const serializedProducts = serializeProducts(products);
        const suggestions = serializedProducts.map((product) => ({
            id: String(product._id),
            label: String(product.name),
            slug: String(product.slug),
            category: product.category,
            subcategory: product.subcategory ?? null,
            brand: product.brand ?? null,
            imageUrl: extractPrimaryMediaUrl(product.media),
            pricing: {
                originalPrice: product.pricing.originalPrice,
                discountedPrice: product.pricing.discountedPrice,
                hasActivePromo: product.pricing.hasActivePromo,
                activePromo: product.pricing.activePromo,
            },
        }));

        logger.info({ query, resultCount: suggestions.length }, 'Product suggestions fetched');

        return ResponseHandler.success(
            c,
            SYSTEM_MESSAGES.SUCCESS.PRODUCT_SUGGESTIONS_FETCHED,
            {
                query,
                suggestions,
            },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to fetch product suggestions');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_SUGGESTIONS_FETCH_FAILED, 500);
    }
};
