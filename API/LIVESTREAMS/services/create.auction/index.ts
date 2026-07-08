import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES, USER_TYPES } from '../../../../CORE/utils/constants/index.js';
import { broadcastLivestreamEvent } from '../../../../CORE/services/livestreamBroadcast/index.js';
import { User } from '../../../AUTH/models/index.js';
import { LivestreamAuction, LivestreamSession } from '../../models/index.js';
import { createAuctionSchema } from '../../schemas/index.js';
import { broadcastLivestreamProducts } from '../../utils/livestreamProducts.js';

export const createAuctionController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
        const vendorId = String(sessionUser.id ?? sessionUser._id);
        const vendor = await User.findById(vendorId).select('userType').lean();
        if (!vendor || String(vendor.userType).toLowerCase() !== USER_TYPES.VENDOR) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const livestreamId = c.req.param('livestreamId');
        if (!livestreamId) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

        const body = await c.req.json().catch(() => ({}));
        const parsed = createAuctionSchema.safeParse(body);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED, 400);
        }

        const livestream = await LivestreamSession.findOne({ _id: livestreamId, vendorId }).lean();
        if (!livestream) throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);

        const { Product } = await import('../../../PRODUCTS/models/index.js');
        const { assertProductHasStock } = await import('../../../PRODUCTS/utils/inventory.js');
        const listedProduct = await Product.findById(parsed.data.productId)
            .select('auctionSettings pricing name inventory')
            .lean();

        if (!listedProduct) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
        }

        await assertProductHasStock(parsed.data.productId, 1);

        const defaultStartingBid =
            listedProduct?.auctionSettings?.startingBid ?? listedProduct?.pricing?.amount ?? parsed.data.startingBid;
        const defaultMinimumIncrement =
            listedProduct?.auctionSettings?.minimumIncrement ?? parsed.data.minimumIncrement;

        if (!livestream.listedProductIds.some((id) => String(id) === parsed.data.productId)) {
            throw new AppError('The selected product is not listed on this livestream', 400);
        }

        const existingOpenAuction = await LivestreamAuction.findOne({
            livestreamId,
            productId: new mongoose.Types.ObjectId(parsed.data.productId),
            status: 'open',
            endsAt: { $gt: new Date() },
        })
            .select('_id')
            .lean();

        if (existingOpenAuction) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_IN_LIVE_AUCTION, 409);
        }

        const bidInactivitySeconds = parsed.data.bidInactivitySeconds;
        const endsAt = new Date(Date.now() + bidInactivitySeconds * 1000);

        const auction = await LivestreamAuction.create({
            livestreamId,
            productId: parsed.data.productId,
            vendorId,
            status: 'open',
            startingBid: parsed.data.startingBid ?? defaultStartingBid,
            minimumIncrement: parsed.data.minimumIncrement ?? defaultMinimumIncrement,
            bidInactivitySeconds,
            endsAt,
        });

        const auctionPayload = {
            type: 'auction.created' as const,
            livestreamId,
            auctionId: String(auction._id),
            productId: parsed.data.productId,
            productName: listedProduct?.name ?? 'Product',
            startingBid: auction.startingBid,
            minimumIncrement: auction.minimumIncrement,
            bidInactivitySeconds,
            endsAt: auction.endsAt.toISOString(),
            createdAt: auction.createdAt.toISOString(),
        };

        await broadcastLivestreamEvent(livestreamId, auctionPayload);
        await broadcastLivestreamProducts(livestreamId);

        const { dispatchAuctionStartedAlerts } = await import(
            '../../../LIVE_ALERTS/services/dispatch.auction.alerts/index.js'
        );
        void dispatchAuctionStartedAlerts({
            vendorId,
            livestreamId,
            auctionId: String(auction._id),
            productId: parsed.data.productId,
            productName: listedProduct?.name ?? 'Product',
            startingBid: auction.startingBid,
            hostUserId: vendorId,
        }).catch((alertError: unknown) => {
            logger.error({ alertError, auctionId: auction._id }, 'Auction alert dispatch failed');
        });

        logger.info({ livestreamId, auctionId: auction._id, vendorId }, 'Livestream auction created');

        return ResponseHandler.success(
            c,
            SYSTEM_MESSAGES.SUCCESS.AUCTION_CREATED,
            { auction },
            undefined,
            201,
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to create auction');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
    }
};
