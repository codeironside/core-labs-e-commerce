import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { LivestreamParticipant, LivestreamSession } from '../../models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { User } from '../../../AUTH/models/index.js';
import { resolveCoverImageUrl } from '../../utils/coverImage.js';

export const fetchActiveLivestreamsController = async (c: Context) => {
    try {
        // Active = not ended/cancelled, no endedAt, and either explicit active or legacy rows with no status
        const sessions = await LivestreamSession.find({
            $and: [
                { status: { $nin: ['ended', 'cancelled'] } },
                { $or: [{ status: 'active' }, { status: { $exists: false } }] },
                { $or: [{ endedAt: { $exists: false } }, { endedAt: null }] },
            ],
        })
            .select('_id title description vendorId hostUserId agoraChannelName agoraAppId listedProductIds recordingEnabled createdAt metadata')
            .sort({ createdAt: -1 })
            .lean();

        // Enrich with vendor display name
        const vendorIds = [...new Set(sessions.map(s => String(s.vendorId)))];
        const vendors = await User.find({ _id: { $in: vendorIds } })
            .select('_id name vendorProfile')
            .lean();
        const vendorMap = new Map(vendors.map(v => [String(v._id), v]));

        // Enrich with primary product image for the stream thumbnail
        const allProductIds = sessions.flatMap(s => (s.listedProductIds ?? []).map(String));
        const uniqueProductIds = [...new Set(allProductIds)];
        const products = await Product.find({ _id: { $in: uniqueProductIds } })
            .select('_id name pricing media')
            .lean();
        const productMap = new Map(products.map(p => [String(p._id), p]));

        const sessionIds = sessions.map((session) => session._id);
        const viewerCountRows = sessionIds.length > 0
            ? await LivestreamParticipant.aggregate<{ _id: unknown; count: number }>([
                { $match: { livestreamId: { $in: sessionIds } } },
                { $group: { _id: '$livestreamId', count: { $sum: 1 } } },
            ])
            : [];
        const viewerCountMap = new Map(
            viewerCountRows.map((row) => [String(row._id), row.count]),
        );

        const enriched = sessions.map(s => {
            const vendor = vendorMap.get(String(s.vendorId));
            const listedProducts = (s.listedProductIds ?? [])
                .map(pid => productMap.get(String(pid)))
                .filter(Boolean);

            const coverImageUrl = resolveCoverImageUrl(s.metadata);
            const primaryImage = coverImageUrl
                ?? listedProducts
                .flatMap((p: { media?: Array<{ isPrimary?: boolean; thumbnailUrl?: string }> }) => p.media ?? [])
                .find((m) => m.isPrimary)?.thumbnailUrl
                ?? listedProducts.flatMap((p: { media?: Array<{ thumbnailUrl?: string }> }) => p.media ?? [])[0]?.thumbnailUrl
                ?? null;

            return {
                id: String(s._id),
                title: s.title,
                description: s.description,
                vendorId: String(s.vendorId),
                hostUserId: s.hostUserId ? String(s.hostUserId) : undefined,
                vendorName: vendor?.name ?? 'Vendor',
                vendorAvatar: (vendor as { vendorProfile?: { avatarUrl?: string } })?.vendorProfile?.avatarUrl ?? null,
                productCount: listedProducts.length,
                thumbnailUrl: primaryImage,
                viewerCount: viewerCountMap.get(String(s._id)) ?? 0,
                createdAt: s.createdAt,
            };
        });

        enriched.sort((left, right) => {
            if (right.viewerCount !== left.viewerCount) {
                return right.viewerCount - left.viewerCount;
            }
            const rightCreated = right.createdAt ? new Date(right.createdAt).getTime() : 0;
            const leftCreated = left.createdAt ? new Date(left.createdAt).getTime() : 0;
            return rightCreated - leftCreated;
        });

        logger.info({ count: enriched.length }, 'Active livestreams fetched');

        return ResponseHandler.success(c, 'Active livestreams fetched.', {
            count: enriched.length,
            livestreams: enriched,
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to fetch active livestreams');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_FETCH_FAILED, 500);
    }
};
