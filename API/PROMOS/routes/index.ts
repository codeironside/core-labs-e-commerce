import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireRole } from '../../../CORE/middlewares/rbac/index.js';
import { ROLE_NAMES } from '../../../CORE/utils/constants/index.js';
import {
    createPromoController,
    applyToPlatformPromoController,
} from '../services/create.promo/index.js';
import { attachPromoController, detachPromoController } from '../services/manage.promo/index.js';
import { reviewVendorApplicationController } from '../services/review.promo/index.js';
import {
    listPromosController,
    getPromoController,
    updatePromoController,
} from '../services/manage.promos/index.js';

export const promosRouter = new OpenAPIHono({ strict: false });

const vendorAndAdminMiddleware = requireRole([ROLE_NAMES.VENDOR, ROLE_NAMES.ADMIN, ROLE_NAMES.ADMIN_L1]);
const adminOnlyMiddleware = requireRole([ROLE_NAMES.ADMIN, ROLE_NAMES.ADMIN_L1]);

const promoVendorApplicationSchema = z.object({
    vendorId: z.string(),
    applicationStatus: z.enum(['pending', 'approved', 'rejected']),
    appliedAt: z.string().datetime(),
    reviewedAt: z.string().datetime().optional(),
    reviewNote: z.string().optional(),
});

const promoResponseSchema = z.object({
    _id: z.string().openapi({ example: '6820a1b3c4d5e6f7a8b9c0d1' }),
    createdBy: z.string().openapi({ example: '67f6df0aa7125d4ab7c0af10' }),
    creatorRole: z.enum(['vendor', 'admin']).openapi({ example: 'admin' }),
    scope: z.enum(['product', 'category', 'platform', 'logistics']).openapi({ example: 'category' }),
    title: z.string().openapi({ example: '20% Off Mens Wear' }),
    description: z.string().optional(),
    code: z.string().optional().openapi({ example: 'FLASH20' }),
    type: z.enum(['percentage', 'fixed']).openapi({ example: 'percentage' }),
    value: z.number().openapi({ example: 20 }),
    currency: z.string().optional().openapi({
        example: 'USD',
        description: 'Required when type is "fixed". The currency the fixed discount amount is denominated in.',
    }),
    productIds: z.array(z.string()).openapi({ example: [] }),
    categories: z.array(z.string()).openapi({ example: ['mens-wear'] }),
    applyPlatformWide: z.boolean().openapi({ example: false }),
    isLogisticsPromo: z.boolean().openapi({ example: false }),
    logisticsRegions: z.array(z.string()).openapi({ example: ['NG'] }),
    maxShippingDiscountAmount: z.number().optional(),
    maxDiscountPerItem: z.number().optional().openapi({ example: 2000 }),
    maxCategoriesApplied: z.number().optional().openapi({ example: 1 }),
    maxTotalRedemptions: z.number().optional().openapi({ example: 500 }),
    maxRedemptionsPerUser: z.number().optional().openapi({ example: 1 }),
    currentRedemptions: z.number().openapi({ example: 0 }),
    vendorApplications: z.array(promoVendorApplicationSchema).openapi({ example: [] }),
    startsAt: z.string().datetime().openapi({ example: '2026-04-20T00:00:00.000Z' }),
    endsAt: z.string().datetime().optional().openapi({ example: '2026-04-22T23:59:59.000Z' }),
    status: z.enum(['active', 'inactive', 'expired']).openapi({ example: 'active' }),
    approvalStatus: z.enum(['pending', 'approved', 'rejected']).openapi({ example: 'approved' }),
    approvedBy: z.string().optional(),
    approvalNote: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

const vendorPromoCreatedExample = {
    _id: '6820a1b3c4d5e6f7a8b9c0d1',
    createdBy: '67f6df0aa7125d4ab7c0af10',
    creatorRole: 'vendor',
    scope: 'product',
    title: '10% Off My Sneakers',
    type: 'percentage',
    value: 10,
    code: 'SNEAKER10',
    productIds: ['67f6e0b5a7125d4ab7c0af91'],
    categories: [],
    applyPlatformWide: false,
    isLogisticsPromo: false,
    logisticsRegions: [],
    currentRedemptions: 0,
    vendorApplications: [],
    startsAt: '2026-04-20T00:00:00.000Z',
    endsAt: '2026-04-30T23:59:59.000Z',
    status: 'active',
    approvalStatus: 'approved',
    createdAt: '2026-04-16T10:00:00.000Z',
    updatedAt: '2026-04-16T10:00:00.000Z',
};

const standardErrorResponse = { description: 'Error response', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } } };

const createPromoRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Promos'],
    summary: 'Create a promo',
    description:
        'Creates a new promo. **Vendors** can only create `scope: "product"` promos targeting their own product(s). Vendor promos are automatically approved and go live immediately. **Admins** can create promos of any scope (`product`, `category`, `platform`, `logistics`). Both vendors and admins can add an optional coupon `code`, set redemption limits, and time-bound the promo.',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        title: z.string().min(2).openapi({ example: '10% Off My Sneakers' }),
                        description: z.string().optional().openapi({ example: 'Weekend flash sale on selected sneakers.' }),
                        code: z.string().optional().openapi({
                            example: 'SNEAKER10',
                            description: 'Optional coupon code buyers can enter at checkout. Must be unique across all active promos.',
                        }),
                        type: z.enum(['percentage', 'fixed']).openapi({ example: 'percentage' }),
                        value: z.number().positive().openapi({
                            example: 10,
                            description: 'Discount amount — a percentage (1–100) or a fixed currency amount.',
                        }),
                        currency: z.string().optional().openapi({
                            example: 'NGN',
                            description: 'Required when type is "fixed". ISO 4217 or crypto currency code (e.g. NGN, USD, SOL, USDC). Tells buyers the denomination of the fixed discount value.',
                        }),
                        scope: z.enum(['product', 'category', 'platform', 'logistics']).openapi({
                            example: 'product',
                            description:
                                '`product` — targeted product IDs. `category` — all products in specified category slugs. `platform` — applies to every product site-wide. `logistics` — discount on shipping costs. **Vendors can only use `product`.**',
                        }),
                        productIds: z.array(z.string().length(24)).optional().openapi({
                            example: ['67f6e0b5a7125d4ab7c0af91'],
                            description: 'IDs of the specific products this promo targets.',
                        }),
                        categories: z.array(z.string()).optional().openapi({
                            example: ['mens-wear', 'shoes'],
                            description: 'Category slugs. Admin only.',
                        }),
                        applyPlatformWide: z.boolean().optional().openapi({
                            example: false,
                            description: 'If true, applies to every active product on the platform. Admin only.',
                        }),
                        isLogisticsPromo: z.boolean().optional().openapi({
                            example: false,
                            description: 'If true, this promo discounts shipping costs rather than product prices. Admin only.',
                        }),
                        logisticsRegions: z.array(z.string()).optional().openapi({
                            example: ['NG', 'GH'],
                            description: 'ISO-3166-1 alpha-2 country codes this logistics promo applies to. Empty means all regions.',
                        }),
                        maxShippingDiscountAmount: z.number().optional().openapi({
                            example: 1500,
                            description: 'Maximum shipping discount in the platform default currency (logistics promos only).',
                        }),
                        maxDiscountPerItem: z.number().optional().openapi({
                            example: 2000,
                            description: 'Maximum discount amount per product unit regardless of percentage calculation.',
                        }),
                        maxCategoriesApplied: z.number().optional().openapi({
                            example: 3,
                            description: 'Cap on how many distinct categories receive this promo (admin category promos).',
                        }),
                        maxTotalRedemptions: z.number().optional().openapi({
                            example: 500,
                            description: 'Total redemption cap across all buyers before the promo is deactivated.',
                        }),
                        maxRedemptionsPerUser: z.number().optional().openapi({
                            example: 1,
                            description: 'How many times a single buyer can redeem this promo.',
                        }),
                        startsAt: z.string().datetime().openapi({ example: '2026-04-20T00:00:00.000Z' }),
                        endsAt: z.string().datetime().optional().openapi({ example: '2026-04-30T23:59:59.000Z' }),
                    }),
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Promo created and immediately active. For vendors this is always `approvalStatus: "approved"`. Vendor promos never go through admin approval.',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.object({ promo: promoResponseSchema }),
                    }).openapi({ example: { success: true, message: 'Promo created successfully.', data: { promo: vendorPromoCreatedExample } } }),
                },
            },
        },
        400: standardErrorResponse,
        401: standardErrorResponse,
        403: { description: 'Forbidden — vendors cannot create category, platform, or logistics promos', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } } },
        409: { description: 'Promo code already in use', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } } },
    },
});

const applyToPlatformPromoRoute = createRoute({
    method: 'post',
    path: '/platform/{promoId}/apply',
    tags: ['Promos'],
    summary: 'Apply to participate in a platform promo (vendor)',
    description:
        'Vendors submit an application to opt their products into an admin-created platform promo (e.g., "20% off Mens Wear"). The application starts with `applicationStatus: "pending"` until an admin approves or rejects it via the admin review endpoint. Vendors are notified of the outcome by email and in-app notification.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            promoId: z.string().length(24).openapi({ example: '6820a1b3c4d5e6f7a8b9c0d1' }),
        }),
    },
    responses: {
        200: {
            description: 'Application submitted and pending admin review.',
            content: {
                'application/json': {
                    schema: z.object({ success: z.boolean(), message: z.string() }).openapi({
                        example: { success: true, message: 'Application submitted. An admin will review your application shortly.' },
                    }),
                },
            },
        },
        400: standardErrorResponse,
        401: standardErrorResponse,
        403: standardErrorResponse,
        404: { description: 'Platform promo not found', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } } },
        409: { description: 'Already applied to this promo', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } } },
    },
});

const listPromosRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Promos'],
    summary: 'List promos',
    description:
        'Vendors see only their own promos. Admins see all promos with optional filters by scope, status, approvalStatus, creatorRole, and isLogisticsPromo.',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            page: z.coerce.number().default(1).openapi({ example: 1 }),
            limit: z.coerce.number().default(20).openapi({ example: 20 }),
            scope: z.enum(['product', 'category', 'platform', 'logistics']).optional(),
            status: z.enum(['active', 'inactive', 'expired']).optional(),
            approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
            creatorRole: z.enum(['vendor', 'admin']).optional(),
            isLogisticsPromo: z.string().optional().openapi({ example: 'false', description: 'Filter to logistics-only promos.' }),
        }),
    },
    responses: {
        200: {
            description: 'Promos list returned with pagination.',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.object({ promos: z.array(promoResponseSchema) }),
                        meta: z.object({ page: z.number(), limit: z.number(), total: z.number(), pages: z.number() }),
                    }),
                },
            },
        },
        401: standardErrorResponse,
        403: standardErrorResponse,
    },
});

const getPromoRoute = createRoute({
    method: 'get',
    path: '/{promoId}',
    tags: ['Promos'],
    summary: 'Get a single promo by ID',
    description: 'Vendors can only fetch their own promos. Admins can fetch any.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ promoId: z.string().length(24).openapi({ example: '6820a1b3c4d5e6f7a8b9c0d1' }) }),
    },
    responses: {
        200: {
            description: 'Promo returned.',
            content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.object({ promo: promoResponseSchema }) }) } },
        },
        401: standardErrorResponse,
        403: standardErrorResponse,
        404: standardErrorResponse,
    },
});

const updatePromoRoute = createRoute({
    method: 'patch',
    path: '/{promoId}',
    tags: ['Promos'],
    summary: 'Update a promo',
    description:
        'Updates mutable fields on a promo. Vendors can update their own product promos — changes take effect immediately (no re-approval required). Admins can update any promo.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ promoId: z.string().length(24).openapi({ example: '6820a1b3c4d5e6f7a8b9c0d1' }) }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        title: z.string().optional(),
                        description: z.string().optional(),
                        value: z.number().optional().openapi({ example: 15 }),
                        startsAt: z.string().datetime().optional(),
                        endsAt: z.string().datetime().optional().openapi({ example: '2026-04-30T23:59:59.000Z' }),
                        status: z.enum(['active', 'inactive']).optional(),
                        maxTotalRedemptions: z.number().optional(),
                        maxRedemptionsPerUser: z.number().optional(),
                        maxDiscountPerItem: z.number().optional(),
                    }).openapi({ example: { value: 15, endsAt: '2026-04-30T23:59:59.000Z' } }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Promo updated.',
            content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string(), data: z.object({ promo: promoResponseSchema }) }) } },
        },
        400: standardErrorResponse,
        401: standardErrorResponse,
        403: standardErrorResponse,
        404: standardErrorResponse,
    },
});

const attachPromoRoute = createRoute({
    method: 'post',
    path: '/{promoId}/attach/{productId}',
    tags: ['Promos'],
    summary: 'Attach a vendor promo to a product',
    description:
        'Sets the vendor-controlled `activePromoId` on a product. Only one vendor promo can be active per product at a time — attaching a new one replaces the previous. Vendors can only attach their own promos to their own products. Admins can manage any.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            promoId: z.string().length(24).openapi({ example: '6820a1b3c4d5e6f7a8b9c0d1' }),
            productId: z.string().length(24).openapi({ example: '67f6e0b5a7125d4ab7c0af91' }),
        }),
    },
    responses: {
        200: {
            description: 'Promo attached. Buyers will see the discounted price at checkout.',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.object({ promoId: z.string(), productId: z.string() }),
                    }).openapi({ example: { success: true, message: 'Promo attached to product successfully.', data: { promoId: '6820a1b3c4d5e6f7a8b9c0d1', productId: '67f6e0b5a7125d4ab7c0af91' } } }),
                },
            },
        },
        400: standardErrorResponse,
        401: standardErrorResponse,
        403: standardErrorResponse,
        404: standardErrorResponse,
    },
});

const detachPromoRoute = createRoute({
    method: 'delete',
    path: '/detach/{productId}',
    tags: ['Promos'],
    summary: 'Detach the active vendor promo from a product',
    description:
        'Removes the vendor-attached `activePromoId` from a product. Platform-level admin promos are resolved dynamically and are not affected by this endpoint.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            productId: z.string().length(24).openapi({ example: '67f6e0b5a7125d4ab7c0af91' }),
        }),
    },
    responses: {
        200: {
            description: 'Vendor promo removed from product.',
            content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } },
        },
        401: standardErrorResponse,
        403: standardErrorResponse,
        404: standardErrorResponse,
    },
});

const reviewVendorApplicationRoute = createRoute({
    method: 'post',
    path: '/admin/{promoId}/applications/{vendorId}/review',
    tags: ['Promos — Admin'],
    summary: "Approve or reject a vendor's platform promo application",
    description:
        "Reviews a vendor's application to participate in an admin-created platform promo. Approving enrolls the vendor — their products in the promo's scope will receive the discount at checkout. Rejecting removes them from consideration. The vendor is notified by email and in-app either way.",
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            promoId: z.string().length(24).openapi({ example: '6820a1b3c4d5e6f7a8b9c0d1' }),
            vendorId: z.string().length(24).openapi({ example: '67f6df0aa7125d4ab7c0af10' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        action: z.enum(['approve', 'reject']).openapi({ example: 'approve' }),
                        note: z.string().optional().openapi({
                            example: 'Products do not match the promo category.',
                            description: 'Optional reason note included in the rejection notification sent to the vendor.',
                        }),
                    }).openapi({ example: { action: 'approve' } }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Application reviewed. Vendor is notified by email and in-app.',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.object({ promo: promoResponseSchema }),
                    }),
                },
            },
        },
        400: { description: 'Application already reviewed or invalid action', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } } },
        401: standardErrorResponse,
        403: { description: 'Admin only', content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } } },
        404: standardErrorResponse,
    },
});

promosRouter.use('/admin/*', adminOnlyMiddleware);
promosRouter.use('/platform/*', vendorAndAdminMiddleware);
promosRouter.use('/detach/*', vendorAndAdminMiddleware);
promosRouter.use('/', vendorAndAdminMiddleware);
promosRouter.use('/:promoId', vendorAndAdminMiddleware);
promosRouter.use('/:promoId/*', vendorAndAdminMiddleware);

promosRouter.openapi(createPromoRoute, createPromoController as any);
promosRouter.openapi(listPromosRoute, listPromosController as any);
promosRouter.openapi(getPromoRoute, getPromoController as any);
promosRouter.openapi(updatePromoRoute, updatePromoController as any);
promosRouter.openapi(applyToPlatformPromoRoute, applyToPlatformPromoController as any);
promosRouter.openapi(attachPromoRoute, attachPromoController as any);
promosRouter.openapi(detachPromoRoute, detachPromoController as any);
promosRouter.openapi(reviewVendorApplicationRoute, reviewVendorApplicationController as any);
