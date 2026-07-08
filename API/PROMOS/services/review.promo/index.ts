import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES, ROLE_NAMES } from '../../../../CORE/utils/constants/index.js';
import { Promo } from '../../models/index.js';
import { publishNotificationDispatch } from '../../../../CORE/services/kafka/index.js';
import { User } from '../../../AUTH/models/index.js';
export const reviewVendorApplicationController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const dbUser = await User.findById(sessionUser.id ?? sessionUser._id).select('role').lean();
        const userRole: string = dbUser?.role ?? '';
        const isAdmin =
            userRole === ROLE_NAMES.ADMIN
            || userRole === ROLE_NAMES.ADMIN_L1
            || userRole === ROLE_NAMES.SUPER_ADMIN;
        if (!isAdmin) throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);

        const promoId = c.req.param('promoId');
        const vendorId = c.req.param('vendorId');

        if (!promoId || !vendorId || !mongoose.isValidObjectId(promoId) || !mongoose.isValidObjectId(vendorId)) {
            throw new AppError('Invalid promoId or vendorId.', 400);
        }

        const body = await c.req.json().catch(() => ({}));
        const { action, note } = body as { action: 'approve' | 'reject'; note?: string };

        if (!['approve', 'reject'].includes(action)) {
            throw new AppError('action must be "approve" or "reject".', 400);
        }

        const promo = await Promo.findOne({
            _id: new mongoose.Types.ObjectId(promoId),
            'vendorApplications.vendorId': new mongoose.Types.ObjectId(vendorId),
        });
        if (!promo) throw new AppError('Promo or vendor application not found.', 404);

        const applicationIndex = promo.vendorApplications.findIndex(
            (a) => String(a.vendorId) === vendorId,
        );
        if (applicationIndex === -1) throw new AppError('Vendor application not found.', 404);

        const application = promo.vendorApplications[applicationIndex]!;
        if (application.applicationStatus !== 'pending') {
            throw new AppError('This application has already been reviewed.', 400);
        }

        promo.vendorApplications[applicationIndex] = {
            ...application,
            applicationStatus: action === 'approve' ? 'approved' : 'rejected',
            reviewedAt: new Date(),
            ...(note ? { reviewNote: note.trim() } : {}),
        };

        await promo.save();

        logger.info({ promoId, vendorId, action }, '[Promos] Vendor application reviewed');

        const title =
            action === 'approve'
                ? `Application approved: "${promo.title}"`
                : `Application not approved: "${promo.title}"`;
        const notificationBody =
            action === 'approve'
                ? `Your request to participate in the platform promo "${promo.title}" has been approved. Your products will now benefit from the discount.`
                : `Your request to participate in the platform promo "${promo.title}" was not approved.${note ? ` Reason: ${note}` : ''}`;

        publishNotificationDispatch({
            userId: vendorId,
            category: 'all',
            title,
            body: notificationBody,
            accent: action === 'approve' ? 'success' : 'warning',
            metadata: {
                promoId,
                action,
            },
        }).catch((err) => logger.error({ err, vendorId }, '[Promos] Vendor application notification dispatch failed'));
        return ResponseHandler.success(
            c,
            action === 'approve'
                ? 'Vendor application approved.'
                : 'Vendor application rejected.',
            { promo },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, '[Promos] Failed to review vendor application');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.PROMO_REVIEW_FAILED, 500);
    }
};
