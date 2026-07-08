import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireRole } from '../../../CORE/middlewares/rbac/index.js';
import { ROLE_NAMES } from '../../../CORE/utils/constants/index.js';
import { createLivestreamController } from '../services/create.livestream/index.js';
import { fetchVendorLivestreamsController } from '../services/fetch.vendor.livestreams/index.js';
import { fetchLivestreamController } from '../services/fetch.livestream/index.js';
import { joinLivestreamController } from '../services/join.livestream/index.js';
import { createAuctionController } from '../services/create.auction/index.js';
import { placeBidController } from '../services/place.bid/index.js';
import { closeAuctionController } from '../services/close.auction/index.js';
import { fetchOpenAuctionsController } from '../services/fetch.open.auctions/index.js';
import { createCommentController } from '../services/create.comment/index.js';
import { fetchLivestreamCommentsController } from '../services/fetch.comments/index.js';
import { streamLivestreamEventsController } from '../services/stream.events/index.js';
import { endLivestreamController } from '../services/end.livestream/index.js';
import { cancelLivestreamController } from '../services/cancel.livestream/index.js';
import { adminCancelLivestreamController } from '../services/admin.cancel.livestream/index.js';
import {
  addLivestreamHighlightController,
  adminManageRecordingController,
  setRecordingVisibilityController,
} from '../services/manage.recording/index.js';
import { updateListedProductsController } from '../services/update.listed.products/index.js';
import { banLivestreamParticipantController } from '../services/ban.participant/index.js';
import { fetchActiveLivestreamsController } from '../services/fetch.active.livestreams/index.js';
import { fetchLivestreamAnalyticsController } from '../services/fetch.livestream.analytics/index.js';
import {
  captureHighlightMomentController,
} from '../services/clip.highlight/index.js';
import { watchLivestreamController } from '../services/watch.livestream/index.js';
import { issueShareCameraTokenController } from '../services/issue.share.camera.token/index.js';
import { createLivestreamOrderController } from '../services/create.live.order/index.js';
import { fetchAuctionWinnersController } from '../services/fetch.auction.winners/index.js';
import { createAuctionSchema } from '../schemas/index.js';


export const livestreamsRouter = new OpenAPIHono({ strict: false });

const createLivestreamRoute = createRoute({
    method: 'post',
    path: '/vendor',
    middleware: requireRole([ROLE_NAMES.VENDOR, ROLE_NAMES.USER]) as never,
    tags: ['Livestreams — Vendor'],
    summary: 'Create an Agora livestream channel',
    description:
        'Creates a vendor livestream session backed by Agora RTC and returns the `appId`, `channelName`, and a publisher `hostToken` the vendor\'s SDK uses to start broadcasting. Viewer tokens are issued per-user via `POST /api/v1/livestreams/{livestreamId}/join`. App-side interaction (comments, bids, presence) is realtime through the SSE endpoint `GET /api/v1/livestreams/{livestreamId}/events`.',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        title: z.string().min(3),
                        description: z.string().optional(),
                        productId: z.string().length(24).optional(),
                        listedProductIds: z.array(z.string().length(24)).optional(),
                        recordingEnabled: z.boolean().optional(),
                        tokenExpirySeconds: z.number().int().min(3600).max(86400).optional(),
                    }),
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Livestream created',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.any(),
                    }),
                },
            },
        },
        400: { description: 'Validation error' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
    },
});


const fetchVendorLivestreamsRoute = createRoute({
    method: 'get',
    path: '/vendor/mine',
    tags: ['Livestreams — Vendor'],
    summary: 'List vendor livestream sessions',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            page: z.coerce.number().default(1),
            limit: z.coerce.number().default(20),
            productId: z.string().length(24).optional(),
        }),
    },
    responses: {
        200: {
            description: 'Livestreams returned',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.any(),
                        meta: z.any(),
                    }),
                },
            },
        },
    },
});

const fetchLivestreamRoute = createRoute({
    method: 'get',
    path: '/vendor/{livestreamId}',
    tags: ['Livestreams — Vendor'],
    summary: 'Get a vendor livestream session',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            livestreamId: z.string().length(24),
        }),
    },
    responses: {
        200: {
            description: 'Livestream returned',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.any(),
                    }),
                },
            },
        },
        404: { description: 'Livestream not found' },
    },
});

const joinLivestreamRoute = createRoute({
    method: 'post',
    path: '/{livestreamId}/join',
    tags: ['Livestreams'],
    summary: 'Join a livestream session',
    description:
        'Users, vendors, and admins join a livestream with this endpoint before participating. After joining, clients can post realtime chat comments to `/api/v1/livestreams/{livestreamId}/comments` and subscribe to `/api/v1/livestreams/{livestreamId}/events` for presence, bids, comments, auction state, and livestream status updates.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            livestreamId: z.string().length(24),
        }),
    },
    responses: {
        200: {
            description: 'Livestream joined',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.any(),
                    }),
                },
            },
        },
    },
});

const streamLivestreamEventsRoute = createRoute({
    method: 'get',
    path: '/{livestreamId}/events',
    tags: ['Livestreams'],
    summary: 'Stream realtime livestream events over SSE',
    description:
        'Opens a Server-Sent Events stream for realtime interaction around the live video. Event types include viewer joins, comments, bids, auction creation/close, and Agora livestream status sync. Use this together with the Agora `channelName` and `viewerToken` returned by the join endpoint.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            livestreamId: z.string().length(24),
        }),
    },
    responses: {
        200: { description: 'SSE stream opened' },
    },
});

const createCommentRoute = createRoute({
    method: 'post',
    path: '/{livestreamId}/comments',
    tags: ['Livestreams'],
    summary: 'Post a live comment',
    description:
        'Posts a realtime chat message into the livestream conversation. The comment is stored and immediately broadcast to SSE subscribers on `/api/v1/livestreams/{livestreamId}/events`.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ livestreamId: z.string().length(24) }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        message: z.string().min(1).max(1000),
                    }),
                },
            },
        },
    },
    responses: {
        201: { description: 'Comment created', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.any() }) } } },
    },
});

const fetchCommentsRoute = createRoute({
    method: 'get',
    path: '/{livestreamId}/comments',
    tags: ['Livestreams'],
    summary: 'Fetch livestream comments',
    description:
        'Returns persisted chat history for the livestream. Use this to hydrate chat history before or alongside subscribing to the realtime SSE feed.',
    request: {
        params: z.object({ livestreamId: z.string().length(24) }),
        query: z.object({
            page: z.coerce.number().default(1),
            limit: z.coerce.number().default(30),
        }),
    },
    responses: {
        200: { description: 'Comments returned', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.any(), meta: z.any() }) } } },
    },
});

const createAuctionRoute = createRoute({
    method: 'post',
    path: '/vendor/{livestreamId}/auctions',
    tags: ['Livestreams — Vendor'],
    summary: 'Open an auction for a livestream-listed product',
    description:
        'Creates an auction for one of the products already listed on the realtime livestream session. Subsequent bids are placed by participants through `/api/v1/livestreams/auctions/{auctionId}/bids`.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ livestreamId: z.string().length(24) }),
        body: {
            content: {
                'application/json': {
                    schema: createAuctionSchema,
                },
            },
        },
    },
    responses: {
        201: { description: 'Auction created', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.any() }) } } },
    },
});

const placeBidRoute = createRoute({
    method: 'post',
    path: '/auctions/{auctionId}/bids',
    tags: ['Livestreams'],
    summary: 'Place a bid on a livestream auction',
    description:
        'Places a realtime auction bid from a livestream participant. Successful bids are persisted and immediately broadcast to SSE subscribers connected to `/api/v1/livestreams/{livestreamId}/events`.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ auctionId: z.string().length(24) }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        amount: z.number().positive(),
                    }),
                },
            },
        },
    },
    responses: {
        200: { description: 'Bid placed', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.any() }) } } },
    },
});

const fetchOpenAuctionsRoute = createRoute({
    method: 'get',
    path: '/{livestreamId}/auctions/open',
    tags: ['Livestreams'],
    summary: 'Fetch open auctions for a livestream',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ livestreamId: z.string().length(24) }),
    },
    responses: {
        200: {
            description: 'Open auctions returned',
            content: {
                'application/json': {
                    schema: z.object({ success: z.boolean(), message: z.string(), data: z.any() }),
                },
            },
        },
    },
});

const closeAuctionRoute = createRoute({
    method: 'post',
    path: '/vendor/auctions/{auctionId}/close',
    tags: ['Livestreams — Vendor'],
    summary: 'Close an auction and create a winner order',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ auctionId: z.string().length(24) }),
    },
    responses: {
        200: { description: 'Auction closed', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.any() }) } } },
    },
});

const endLivestreamRoute = createRoute({
    method: 'post',
    path: '/vendor/{livestreamId}/end',
    tags: ['Livestreams — Vendor'],
    summary: 'End a livestream session',
    description: 'Marks the session as ended in the database and broadcasts a livestream.ended SSE event so all connected viewers can disconnect from Agora gracefully.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ livestreamId: z.string().length(24) }),
    },
    responses: {
        200: {
            description: 'Stream ended',
            content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.any() }) } },
        },
        403: { description: 'Forbidden — not the stream owner' },
        404: { description: 'Livestream not found' },
    },
});

const fetchActiveLivestreamsRoute = createRoute({
    method: 'get',
    path: '/active',
    tags: ['Livestreams — Public'],
    summary: 'Fetch tracking active livestreams',
    description: 'Fetch all livestreams that are currently active',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { description: 'Active livestreams fetched', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.any() }) } } },
    },
});

livestreamsRouter.get('/active', fetchActiveLivestreamsController as any);
livestreamsRouter.get('/:livestreamId/watch', watchLivestreamController as any);
livestreamsRouter.post('/:livestreamId/share-camera/token', issueShareCameraTokenController as any);
livestreamsRouter.use('/:livestreamId/orders', requireRole([ROLE_NAMES.USER, ROLE_NAMES.VENDOR, ROLE_NAMES.ADMIN, ROLE_NAMES.ADMIN_L1]));
livestreamsRouter.post('/:livestreamId/orders', createLivestreamOrderController as any);
livestreamsRouter.openapi(fetchCommentsRoute, fetchLivestreamCommentsController as any);
livestreamsRouter.openapi(fetchOpenAuctionsRoute, fetchOpenAuctionsController as any);
livestreamsRouter.openapi(streamLivestreamEventsRoute, streamLivestreamEventsController as any);
livestreamsRouter.openapi(joinLivestreamRoute, joinLivestreamController as any);
livestreamsRouter.openapi(createCommentRoute, createCommentController as any);
livestreamsRouter.openapi(createLivestreamRoute, createLivestreamController as never);
livestreamsRouter.use('/auctions/:auctionId/bids', requireRole([ROLE_NAMES.USER, ROLE_NAMES.VENDOR, ROLE_NAMES.ADMIN, ROLE_NAMES.ADMIN_L1]));
livestreamsRouter.use('/vendor', requireRole([ROLE_NAMES.VENDOR]));
livestreamsRouter.use('/vendor/*', requireRole([ROLE_NAMES.VENDOR]));
livestreamsRouter.openapi(fetchVendorLivestreamsRoute, fetchVendorLivestreamsController as any);
livestreamsRouter.openapi(fetchLivestreamRoute, fetchLivestreamController as any);
livestreamsRouter.openapi(createAuctionRoute, createAuctionController as any);
livestreamsRouter.openapi(placeBidRoute, placeBidController as any);
livestreamsRouter.openapi(closeAuctionRoute, closeAuctionController as any);
livestreamsRouter.post('/vendor/:livestreamId/products', updateListedProductsController as any);
livestreamsRouter.post('/vendor/:livestreamId/ban', banLivestreamParticipantController as any);
livestreamsRouter.post('/vendor/:livestreamId/cancel', cancelLivestreamController as any);
livestreamsRouter.use(
    '/admin/*',
    requireRole([ROLE_NAMES.ADMIN, ROLE_NAMES.ADMIN_L1, ROLE_NAMES.SUPER_ADMIN]),
);
livestreamsRouter.post('/vendor/:livestreamId/highlights', addLivestreamHighlightController as any);
livestreamsRouter.post('/vendor/:livestreamId/highlights/capture', captureHighlightMomentController as any);
livestreamsRouter.get('/vendor/:livestreamId/analytics', fetchLivestreamAnalyticsController as any);
livestreamsRouter.get('/vendor/:livestreamId/auction-winners', fetchAuctionWinnersController as any);
livestreamsRouter.patch('/vendor/:livestreamId/recording-visibility', setRecordingVisibilityController as any);
livestreamsRouter.post('/admin/:livestreamId/cancel', adminCancelLivestreamController as any);
livestreamsRouter.post('/admin/:livestreamId/recording', adminManageRecordingController as any);
livestreamsRouter.openapi(endLivestreamRoute, endLivestreamController as any);
