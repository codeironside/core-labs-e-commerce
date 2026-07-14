import type { Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { LivestreamProviderService } from '../../../../CORE/services/livestreams/provider/index.js';
import { User } from '../../../AUTH/models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { LivestreamSession } from '../../models/index.js';
import { createLivestreamSchema } from '../../schemas/index.js';
import { assertUserCanHostStream } from '../../../../CORE/services/livestreamConcurrency/index.js';
import { resolveStoreHostAccess } from '../../../STORES/utils/storeAccess.js';
import { LivestreamRecordingService } from '../../../../CORE/services/livestreams/recording/index.js';
import { VendorStore } from '../../../STORES/models/index.js';

export const createLivestreamController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const hostUserId = String(sessionUser.id ?? sessionUser._id);
        const body = await c.req.json().catch(() => ({}));
        const parsed = createLivestreamSchema.safeParse(body);

        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
                400,
            );
        }

        const payload = parsed.data;
        const hostAccess = await resolveStoreHostAccess(hostUserId, payload.storeId);
        const streamVendorId = hostAccess.vendorId;
        const streamStoreId = hostAccess.storeId;

        if (!payload.storeId) {
            const vendor = await User.findById(hostUserId).select('userType vendorProfile').lean();
            if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
                throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
            }
            if (!vendor.vendorProfile?.canGoLive) {
                throw new AppError('Identity verification is required before going live.', 403);
            }
        } else {
            const streamVendor = await User.findById(streamVendorId).select('vendorProfile').lean();
            if (!streamVendor?.vendorProfile?.canGoLive) {
                throw new AppError('Identity verification is required before going live.', 403);
            }
        }

        await assertUserCanHostStream(hostUserId, streamStoreId);

        const productFilter: Record<string, unknown> = { vendorId: streamVendorId };
        if (!hostAccess.isStoreOwner && streamStoreId) {
            productFilter.storeId = streamStoreId;
        }

        const vendorProducts = await Product.find(productFilter)
            .select('_id name pricing media shortDescription status')
            .sort({ updatedAt: -1 })
            .lean();

        const requestedIds = new Set((payload.listedProductIds ?? []).map(String));
        const listedProductIds =
            requestedIds.size > 0
                ? vendorProducts.filter((product) => requestedIds.has(String(product._id))).map((product) => product._id)
                : vendorProducts.filter((product) => product.status === 'active').map((product) => product._id);

        if (listedProductIds.length === 0) {
            throw new AppError('Select at least one product to feature on this stream.', 400);
        }

        const store = streamStoreId
            ? await VendorStore.findById(streamStoreId).select('logoUrl').lean()
            : null;
        const streamCoverImageUrl = payload.coverImageUrl ?? store?.logoUrl;

        const listedProducts = vendorProducts.filter((product) =>
            listedProductIds.some((id) => String(id) === String(product._id)),
        );

        const channelName = `flamigo_${randomUUID().replace(/-/g, '')}`;

        const hostRtc = await LivestreamProviderService.createPublisherSession({
            channelName,
            expireSeconds: payload.tokenExpirySeconds,
        });

        const hostTokenExpiresAt =
            hostRtc.expiresAt ?? Math.floor(Date.now() / 1000) + (payload.tokenExpirySeconds ?? 86400);

        const session = await LivestreamSession.create({
            vendorId: streamVendorId,
            hostUserId,
            ...(streamStoreId ? { storeId: streamStoreId } : {}),
            listedProductIds,
            title: payload.title,
            ...(payload.description ? { description: payload.description } : {}),
            agoraChannelName: channelName,
            agoraAppId: hostRtc.appId ?? hostRtc.provider,
            hostToken: hostRtc.hostToken,
            hostTokenExpiresAt,
            agoraHostUid: hostRtc.uid ?? 0,
            streamProvider: hostRtc.provider,
            ...(hostRtc.playbackUrl !== undefined ? { playbackUrl: hostRtc.playbackUrl } : {}),
            ...(hostRtc.ingestUrl !== undefined ? { ingestUrl: hostRtc.ingestUrl } : {}),
            recordingEnabled: payload.recordingEnabled ?? true,
            status: 'active' as const,
            metadata: {
                ...(hostRtc.cloudflareInputId ? { cloudflareInputId: hostRtc.cloudflareInputId } : {}),
                streamProvider: hostRtc.provider,
                ...(streamCoverImageUrl ? { coverImageUrl: streamCoverImageUrl } : {}),
                ...(payload.coverImagePublicId ? { coverImagePublicId: payload.coverImagePublicId } : {}),
            },
        });

        if (session.recordingEnabled) {
            await LivestreamRecordingService.startRecording({
                livestreamId: session._id,
                provider: hostRtc.provider,
                channelName,
                hostToken: hostRtc.hostToken,
                hostUid: hostRtc.uid ?? 0,
                ...(hostRtc.cloudflareInputId !== undefined
                    ? { cloudflareInputId: hostRtc.cloudflareInputId }
                    : {}),
            }).catch((recordingError: unknown) => {
                logger.error({ recordingError, livestreamId: session._id }, 'Cloud recording start failed');
            });
        }

        logger.info(
            { hostUserId, vendorId: streamVendorId, storeId: streamStoreId, livestreamId: session._id, channelName, productCount: listedProducts.length },
            'Vendor livestream created',
        );

        try {
            const { dispatchLiveAlerts } = await import('../../../LIVE_ALERTS/services/dispatch.live.alerts/index.js');
            void dispatchLiveAlerts({
                vendorId: streamVendorId,
                ...(streamStoreId ? { storeId: streamStoreId } : {}),
                livestreamId: String(session._id),
                title: payload.title,
                hostUserId,
                listedProductIds: listedProducts.map((product) => String(product._id)),
            }).catch((alertError: unknown) => {
                logger.error({ alertError, livestreamId: session._id }, 'Live alert dispatch failed');
            });
        } catch (alertImportError: unknown) {
            logger.error({ alertImportError, livestreamId: session._id }, 'Live alert module unavailable');
        }

        return ResponseHandler.success(
            c,
            SYSTEM_MESSAGES.SUCCESS.LIVESTREAM_CREATED,
            {
                livestream: session,
                products: listedProducts,
                stream: {
                    provider: hostRtc.provider,
                    appId: hostRtc.appId,
                    channelName,
                    hostToken: hostRtc.hostToken,
                    hostTokenExpiresAt: hostRtc.expiresAt,
                    uid: hostRtc.uid,
                    playbackUrl: hostRtc.playbackUrl,
                    ingestUrl: hostRtc.ingestUrl,
                },
            },
            undefined,
            201,
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        const detail = error instanceof Error ? error.message : String(error);
        logger.error(
            {
                err: error,
                message: detail,
            },
            'Failed to create livestream',
        );
        const message =
            process.env.NODE_ENV === 'development'
                ? `Failed to create livestream: ${detail}`
                : SYSTEM_MESSAGES.ERRORS.LIVESTREAM_CREATE_FAILED;
        throw new AppError(message, 500);
    }
};
