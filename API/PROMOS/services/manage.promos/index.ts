import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES, ROLE_NAMES, USER_TYPES } from '../../../../CORE/utils/constants/index.js';
import { Promo } from '../../models/index.js';

export const listPromosController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const userId = sessionUser.userId;
        const userRole = String(sessionUser.role ?? '').toLowerCase();
        const userType = String(sessionUser.userType ?? '').toLowerCase();
        const isAdmin = userRole === ROLE_NAMES.ADMIN || userRole === ROLE_NAMES.SUPER_ADMIN;
        const isVendor = userType === USER_TYPES.VENDOR;

        if (!isAdmin && !isVendor) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const query = c.req.query();
        const page = Math.max(1, Number(query.page ?? 1));
        const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};

        if (isVendor) {
            const browsingPlatformPromos = query.scope === 'platform' && query.creatorRole === 'admin';
            if (browsingPlatformPromos) {
                filter.creatorRole = 'admin';
                filter.scope = 'platform';
                filter.approvalStatus = 'approved';
                filter.status = 'active';
            } else {
                filter.createdBy = new mongoose.Types.ObjectId(userId);
            }
        } else {
            if (query.creatorRole) filter.creatorRole = query.creatorRole;
            if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
        }

        if (query.scope) filter.scope = query.scope;
        if (query.status) filter.status = query.status;
        if (query.isLogisticsPromo !== undefined) filter.isLogisticsPromo = query.isLogisticsPromo === 'true';

        const [promos, total] = await Promise.all([
            Promo.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Promo.countDocuments(filter),
        ]);

        return ResponseHandler.success(
            c,
            'Promos fetched successfully.',
            { promos },
            { page, limit, total, pages: Math.ceil(total / limit) },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, '[Promos] Failed to list promos');
        throw new AppError('Failed to fetch promos.', 500);
    }
};

export const getPromoController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const userId = String(sessionUser.id ?? sessionUser._id);
        const userRole = String(sessionUser.role ?? '').toLowerCase();
        const userType = String(sessionUser.userType ?? '').toLowerCase();
        const isAdmin = userRole === ROLE_NAMES.ADMIN || userRole === ROLE_NAMES.SUPER_ADMIN;
        const isVendor = userType === USER_TYPES.VENDOR;

        if (!isAdmin && !isVendor) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const { promoId } = c.req.param() as { promoId: string };
        if (!mongoose.isValidObjectId(promoId)) throw new AppError('Invalid promoId.', 400);

        const promo = await Promo.findById(promoId).lean();
        if (!promo) throw new AppError('Promo not found.', 404);

        if (isVendor && String(promo.createdBy) !== userId) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        return ResponseHandler.success(c, 'Promo fetched successfully.', { promo });
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, '[Promos] Failed to fetch promo');
        throw new AppError('Failed to fetch promo.', 500);
    }
};

export const updatePromoController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const userId = String(sessionUser.id ?? sessionUser._id);
        const userRole = String(sessionUser.role ?? '').toLowerCase();
        const userType = String(sessionUser.userType ?? '').toLowerCase();
        const isAdmin = userRole === ROLE_NAMES.ADMIN || userRole === ROLE_NAMES.SUPER_ADMIN;
        const isVendor = userType === USER_TYPES.VENDOR;

        if (!isAdmin && !isVendor) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const { promoId } = c.req.param() as { promoId: string };
        if (!mongoose.isValidObjectId(promoId)) throw new AppError('Invalid promoId.', 400);

        const promo = await Promo.findById(promoId);
        if (!promo) throw new AppError('Promo not found.', 404);

        if (isVendor && String(promo.createdBy) !== userId) {
            throw new AppError('You can only update your own promos.', 403);
        }

        const body = await c.req.json();
        const allowed = ['title', 'description', 'value', 'startsAt', 'endsAt', 'status', 'maxTotalRedemptions', 'maxRedemptionsPerUser', 'maxDiscountPerItem'];

        for (const key of allowed) {
            if (body[key] !== undefined) {
                (promo as any)[key] = key.endsWith('At') ? new Date(body[key]) : body[key];
            }
        }

        if (isVendor && promo.approvalStatus === 'approved') {
            promo.approvalStatus = 'pending';
        }

        await promo.save();

        logger.info({ promoId, userId }, '[Promos] Promo updated');

        return ResponseHandler.success(c, 'Promo updated successfully.', { promo });
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, '[Promos] Failed to update promo');
        throw new AppError('Failed to update promo.', 500);
    }
};
