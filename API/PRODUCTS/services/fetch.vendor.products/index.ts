import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES, USER_TYPES } from '../../../../CORE/utils/constants/index.js';
import { Product } from '../../models/index.js';
import { fetchVendorProductsQuerySchema } from '../../schemas/index.js';
import { serializeProducts } from '../../utils/index.js';

export const fetchVendorProductsController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const vendorId = sessionUser.userId;
        const tokenUserType = String(sessionUser.userType ?? '').toLowerCase();
        if (tokenUserType && tokenUserType !== USER_TYPES.VENDOR) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const parsed = fetchVendorProductsQuerySchema.safeParse(c.req.query());
        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
                400,
            );
        }

        const { page, limit, search, category, subcategory, status } = parsed.data;
        const filter: Record<string, unknown> = mongoose.isValidObjectId(vendorId)
            ? { $or: [{ vendorId: new mongoose.Types.ObjectId(vendorId) }, { vendorId }] }
            : { vendorId };

        if (search) {
            filter.$text = { $search: search };
        }

        if (category) filter.category = category;
        if (subcategory) filter.subcategory = subcategory;
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort(search ? { score: { $meta: 'textScore' } } : { updatedAt: -1 })
                .select(search ? { score: { $meta: 'textScore' } } : {})
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(filter),
        ]);

        logger.info({ vendorId, total }, 'Vendor products fetched');

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
        logger.error({ error }, 'Failed to fetch vendor products');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCTS_FETCH_FAILED, 500);
    }
};
