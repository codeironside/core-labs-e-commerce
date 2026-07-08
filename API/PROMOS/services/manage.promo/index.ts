import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES, ROLE_NAMES } from '../../../../CORE/utils/constants/index.js';
import { Promo } from '../../models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';

export const attachPromoController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const userId = String(sessionUser.id ?? sessionUser._id);
        const userRole: string = (sessionUser as any).role ?? '';
        const isAdmin = userRole === ROLE_NAMES.ADMIN_L1 || userRole === ROLE_NAMES.ADMIN;
        const isVendor = userRole === ROLE_NAMES.VENDOR;

        if (!isAdmin && !isVendor) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const { promoId, productId } = c.req.param() as { promoId: string; productId: string };

        if (!mongoose.isValidObjectId(promoId) || !mongoose.isValidObjectId(productId)) {
            throw new AppError('Invalid promoId or productId.', 400);
        }

        const promo = await Promo.findById(promoId);
        if (!promo) throw new AppError('Promo not found.', 404);

        if (!isAdmin && String(promo.createdBy) !== userId) {
            throw new AppError('You can only attach your own promos.', 403);
        }

        if (promo.approvalStatus !== 'approved') {
            throw new AppError('This promo has not been approved yet.', 400);
        }

        const product = await Product.findById(productId);
        if (!product) throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);

        if (!isAdmin && String(product.vendorId) !== userId) {
            throw new AppError('You can only attach promos to your own products.', 403);
        }

        await Product.findByIdAndUpdate(productId, { activePromoId: promo._id });

        logger.info({ promoId, productId, userId }, '[Promos] Promo attached to product');

        return ResponseHandler.success(c, 'Promo attached to product successfully.', { promoId, productId });
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, '[Promos] Failed to attach promo');
        throw new AppError('Failed to attach promo.', 500);
    }
};

export const detachPromoController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const userId = String(sessionUser.id ?? sessionUser._id);
        const userRole: string = (sessionUser as any).role ?? '';
        const isAdmin = userRole === ROLE_NAMES.ADMIN_L1 || userRole === ROLE_NAMES.ADMIN;
        const isVendor = userRole === ROLE_NAMES.VENDOR;

        if (!isAdmin && !isVendor) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const { productId } = c.req.param() as { productId: string };

        if (!mongoose.isValidObjectId(productId)) {
            throw new AppError('Invalid productId.', 400);
        }

        const product = await Product.findById(productId);
        if (!product) throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);

        if (!isAdmin && String(product.vendorId) !== userId) {
            throw new AppError('You can only detach promos from your own products.', 403);
        }

        await Product.findByIdAndUpdate(productId, { $unset: { activePromoId: 1 } });

        logger.info({ productId, userId }, '[Promos] Promo detached from product');

        return ResponseHandler.success(c, 'Promo detached from product successfully.');
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, '[Promos] Failed to detach promo');
        throw new AppError('Failed to detach promo.', 500);
    }
};
