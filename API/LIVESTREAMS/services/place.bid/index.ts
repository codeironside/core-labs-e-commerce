import type { Context } from 'hono';
import mongoose from 'mongoose';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { broadcastLivestreamEvent } from '../../../../CORE/services/livestreamBroadcast/index.js';
import { LivestreamAuction, LivestreamBid, LivestreamParticipant } from '../../models/index.js';
import { placeBidSchema } from '../../schemas/index.js';

export const placeBidController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const bidderId = String(sessionUser.id ?? sessionUser._id);
        const auctionId = c.req.param('auctionId');
        if (!auctionId) throw new AppError(SYSTEM_MESSAGES.ERRORS.AUCTION_NOT_FOUND, 404);

        const body = await c.req.json().catch(() => ({}));
        const parsed = placeBidSchema.safeParse(body);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED, 400);
        }

        const amount = parsed.data.amount;
        const now = new Date();

        const auctionSnapshot = await LivestreamAuction.findById(auctionId)
            .select('status endsAt startingBid minimumIncrement highestBidAmount livestreamId bidInactivitySeconds')
            .lean();

        if (!auctionSnapshot) throw new AppError(SYSTEM_MESSAGES.ERRORS.AUCTION_NOT_FOUND, 404);
        if (auctionSnapshot.status !== 'open' || auctionSnapshot.endsAt <= now) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.AUCTION_NOT_OPEN, 409);
        }

        const minimumAllowedBid =
            auctionSnapshot.highestBidAmount !== undefined
                ? auctionSnapshot.highestBidAmount + auctionSnapshot.minimumIncrement
                : auctionSnapshot.startingBid;

        if (amount < minimumAllowedBid) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.BID_TOO_LOW, 400);
        }

        const bidFilter: Record<string, unknown> = {
            _id: new mongoose.Types.ObjectId(auctionId),
            status: 'open',
            endsAt: { $gt: now },
        };

        if (auctionSnapshot.highestBidAmount === undefined) {
            bidFilter.startingBid = { $lte: amount };
        } else {
            bidFilter.$expr = {
                $lte: [{ $add: ['$highestBidAmount', '$minimumIncrement'] }, amount],
            };
        }

        const previousAuction = await LivestreamAuction.findOne(bidFilter)
            .select('highestBidderId livestreamId')
            .lean();

        if (!previousAuction) {
            throw new AppError('A higher bid was just placed. Try again.', 409);
        }

        await LivestreamParticipant.findOneAndUpdate(
            { livestreamId: previousAuction.livestreamId, userId: bidderId },
            { $setOnInsert: { livestreamId: previousAuction.livestreamId, userId: bidderId, joinedAt: now } },
            { upsert: true, new: true },
        );

        const bid = await LivestreamBid.create({
            auctionId,
            livestreamId: previousAuction.livestreamId,
            bidderId,
            amount,
        });

        const updatedAuction = await LivestreamAuction.findOneAndUpdate(
            bidFilter,
            {
                $set: {
                    highestBidAmount: amount,
                    highestBidderId: new mongoose.Types.ObjectId(bidderId),
                    endsAt: new Date(
                        now.getTime() + (auctionSnapshot.bidInactivitySeconds ?? 45) * 1000,
                    ),
                },
            },
            { new: true },
        ).lean();

        if (!updatedAuction) {
            await LivestreamBid.findByIdAndDelete(bid._id);
            throw new AppError('A higher bid was just placed. Try again.', 409);
        }

        const livestreamId = String(previousAuction.livestreamId);
        const previousHighestBidderId = previousAuction.highestBidderId
            ? String(previousAuction.highestBidderId)
            : undefined;

        const previousBidAmount =
            auctionSnapshot.highestBidAmount ?? auctionSnapshot.startingBid;

        await broadcastLivestreamEvent(livestreamId, {
            type: 'bid.placed',
            livestreamId,
            auctionId: String(auctionId),
            bidderId,
            amount: bid.amount,
            previousBidAmount,
            endsAt: updatedAuction.endsAt.toISOString(),
            createdAt: bid.createdAt.toISOString(),
        });

        logger.info({ auctionId, bidId: bid._id, bidderId, amount: bid.amount }, 'Bid placed');

        return ResponseHandler.success(c, SYSTEM_MESSAGES.SUCCESS.BID_PLACED, {
            bid,
            auction: {
                ...updatedAuction,
                previousBidAmount,
            },
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to place bid');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.INTERNAL, 500);
    }
};
