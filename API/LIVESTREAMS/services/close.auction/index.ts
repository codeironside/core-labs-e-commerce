import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES, USER_TYPES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { closeLivestreamAuction } from '../../utils/closeAuction.js';

export const closeAuctionController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
        const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
        const vendor = await User.findById(vendorId).select('userType').lean();
        if (!vendor || String(vendor.userType).toLowerCase() !== USER_TYPES.VENDOR) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
        }

        const auctionId = c.req.param('auctionId');
        if (!auctionId) throw new AppError(SYSTEM_MESSAGES.ERRORS.AUCTION_NOT_FOUND, 404);

        const auctionExists = await closeLivestreamAuction({ auctionId, vendorId });

        logger.info({
            auctionId,
            vendorId,
            noBids: auctionExists.noBids,
        }, 'Auction closed');

        return ResponseHandler.success(
            c,
            SYSTEM_MESSAGES.SUCCESS.AUCTION_CLOSED,
            {
              auction: auctionExists.auction,
              winningOrderId: auctionExists.winningOrderId,
              noBids: auctionExists.noBids,
            },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to close auction');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
    }
};
