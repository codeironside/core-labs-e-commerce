import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireRole } from '../../../CORE/middlewares/rbac/index.js';
import { ensureDatabaseConnected } from '../../../CORE/middlewares/database/index.js';
import { requireVendorPayoutSetup } from '../../../CORE/middlewares/vendorPayout/index.js';
import { fetchVendorProductAnalyticsController, fetchVendorProductsOverviewController } from '../services/fetch.vendor.analytics/index.js';
import { fetchVendorHubStatsController } from '../services/fetch.vendor.hub.stats/index.js';
import { ROLE_NAMES } from '../../../CORE/utils/constants/index.js';
import { createProductController } from '../services/create.product/index.js';
import { updateProductController } from '../services/update.product/index.js';
import { fetchProductsController } from '../services/fetch.products/index.js';
import { fetchProductController } from '../services/fetch.product/index.js';
import { fetchVendorProductsController } from '../services/fetch.vendor.products/index.js';
import { suggestProductsController } from '../services/suggest.products/index.js';
import { uploadProductMediaController } from '../services/upload.product.media/index.js';

export const productsRouter = new OpenAPIHono({ strict: false });

const productMediaSchema = z.object({
    assetId: z.string().optional().openapi({
        example: '67f6e044a7125d4ab7c0af44',
        description: 'Uploaded media asset id used to attach this saved media to a product.',
    }),
    kind: z.enum(['image', 'model_3d']).openapi({
        example: 'image',
        description: 'Saved media type on the product model.',
    }),
    url: z.string().url().openapi({
        example: 'https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/hero.jpg',
        description: 'Saved Cloudinary URL for the uploaded file.',
    }),
    thumbnailUrl: z.string().url().optional().openapi({
        example: 'https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/hero.jpg',
        description: 'Display-optimized thumbnail URL for storefront cards, search, and livestream surfaces.',
    }),
    publicId: z.string().openapi({
        example: 'flamigo/products/vendor-a/hero',
        description: 'Cloudinary public id saved on the product model.',
    }),
    mimeType: z.string().openapi({ example: 'image/jpeg' }),
    format: z.string().openapi({ example: 'jpg' }),
    sizeBytes: z.number().openapi({ example: 248132 }),
    originalName: z.string().openapi({ example: 'hero.jpg' }),
    altText: z.string().optional().openapi({ example: 'Front view of the product' }),
    sortOrder: z.number().openapi({ example: 0 }),
    isPrimary: z.boolean().openapi({ example: true }),
    posterUrl: z.string().url().optional().openapi({
        example: 'https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/chair-preview.jpg',
        description: 'Optional preview image URL for a saved 3D model.',
    }),
    posterPublicId: z.string().optional().openapi({
        example: 'flamigo/products/vendor-a/chair-preview',
    }),
});

const productMediaAssetSchema = z.object({
    _id: z.string().openapi({ example: '67f6e044a7125d4ab7c0af44' }),
    vendorId: z.string().openapi({ example: '67f6df0aa7125d4ab7c0af10' }),
    kind: z.enum(['image', 'model_3d']),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    publicId: z.string(),
    mimeType: z.string(),
    format: z.string(),
    sizeBytes: z.number(),
    originalName: z.string(),
    posterUrl: z.string().url().optional(),
    posterPublicId: z.string().optional(),
    status: z.enum(['ready', 'attached']).openapi({
        description: 'Ready assets can be attached to a product. Attached assets are already linked to a product.',
    }),
    attachedProductId: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

const productPricingResponseSchema = z.object({
    currency: z.string(),
    amount: z.number(),
    compareAtAmount: z.number().optional(),
    cost: z.number(),
    taxInclusive: z.boolean(),
    promos: z.array(z.any()),
});

const productInventoryResponseSchema = z.object({
    sku: z.string().optional(),
    barcode: z.string().optional(),
    quantity: z.number(),
    lowStockThreshold: z.number(),
    allowBackorder: z.boolean(),
});

const productDimensionsResponseSchema = z.object({
    weightKg: z.number().optional(),
    lengthCm: z.number().optional(),
    widthCm: z.number().optional(),
    heightCm: z.number().optional(),
});

const productResponseSchema = z.object({
    _id: z.string().openapi({ example: '67f6e0b5a7125d4ab7c0af91' }),
    vendorId: z.string().openapi({ example: '67f6df0aa7125d4ab7c0af10' }),
    name: z.string().openapi({ example: 'Premium Sneaker' }),
    slug: z.string().openapi({ example: 'premium-sneaker' }),
    description: z.string(),
    shortDescription: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().openapi({ example: 'Footwear' }),
    subcategory: z.string().optional(),
    tags: z.array(z.string()),
    characteristics: z.array(z.any()),
    pricing: productPricingResponseSchema,
    inventory: productInventoryResponseSchema,
    dimensions: productDimensionsResponseSchema.optional(),
    media: z.array(productMediaSchema).openapi({
        description:
            'Uploaded images and 3D assets saved on the product model. Each uploaded file is returned as a persisted URL entry.',
    }),
    activePromoId: z.string().optional().openapi({
        example: '6820a1b3c4d5e6f7a8b9c0d1',
        description: 'Vendor-attached promo driving checkout discount when set.',
    }),
    status: z.enum(['draft', 'active', 'archived']),
    publishedAt: z.string().datetime().optional(),
    version: z.number(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

const multipartImageFilesSchema = z.any().optional().openapi({
    type: 'array',
    description:
        'Upload one or more standard product image files. Each successful upload is saved into `product.media` with `kind: "image"` and a persisted `url`.',
    items: {
        type: 'string',
        format: 'binary',
    },
});

const requiredMultipartImageFilesSchema = z.any().openapi({
    type: 'array',
    minItems: 1,
    description:
        'Required. Upload at least one product image. You can upload multiple images for a single product.',
    items: {
        type: 'string',
        format: 'binary',
    },
});

const multipartThreeDAssetFilesSchema = z.any().optional().openapi({
    type: 'array',
    description:
        'Upload one or more 3D model files. Each successful upload is saved into `product.media` with `kind: "model_3d"` and a persisted `url`.',
    items: {
        type: 'string',
        format: 'binary',
    },
});

const multipartThreeDPosterFilesSchema = z.any().optional().openapi({
    type: 'array',
    description:
        'Optional poster images matched by index to `threeDAssets`. Saved on the corresponding product media entry as `posterUrl`.',
    items: {
        type: 'string',
        format: 'binary',
    },
});

const createProductRequestExample = {
    name: 'Premium Sneaker',
    description: 'Lightweight sneaker with breathable mesh upper.',
    category: 'Footwear',
    characteristics: [
        { name: 'Color', value: 'Black', highlighted: true },
        { name: 'Material', value: 'Mesh' },
    ],
    pricing: {
        currency: 'NGN',
        amount: 45000,
        cost: 30000,
    },
    promoId: '6820a1b3c4d5e6f7a8b9c0d1',
    inventory: { quantity: 15, lowStockThreshold: 3 },
    mediaAssetIds: ['67f6e044a7125d4ab7c0af44', '67f6e055a7125d4ab7c0af45'],
    primaryMediaAssetId: '67f6e044a7125d4ab7c0af44',
    status: 'draft',
};

const updateProductRequestExample = {
    version: 0,
    pricing: {
        currency: 'NGN',
        amount: 47000,
        cost: 30000,
        promos: [
            {
                title: 'Flash Sale',
                type: 'fixed',
                value: 2500,
                startsAt: '2026-04-12T08:00:00.000Z',
                active: true,
                code: 'FLASH2500',
            },
        ],
    },
    appendMediaAssetIds: ['67f6e055a7125d4ab7c0af45'],
    primaryMediaAssetId: '67f6e055a7125d4ab7c0af45',
    removeMediaPublicIds: ['flamigo/products/vendor-a/old-image'],
};

const uploadProductMediaRequestExample = {
    images: ['hero-1.jpg', 'hero-2.jpg'],
    threeDAssets: ['chair.glb'],
    threeDPosterImages: ['chair-poster.jpg'],
};

const uploadProductMediaResponseExample = {
    success: true,
    message: 'Product media assets uploaded successfully.',
    data: {
        assets: [
            {
                _id: '67f6e044a7125d4ab7c0af44',
                vendorId: '67f6df0aa7125d4ab7c0af10',
                kind: 'image',
                url: 'https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/hero-1.jpg',
                thumbnailUrl: 'https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/hero-1.jpg',
                publicId: 'flamigo/products/vendor-a/hero-1',
                mimeType: 'image/jpeg',
                format: 'jpg',
                sizeBytes: 248132,
                originalName: 'hero-1.jpg',
                status: 'ready',
                createdAt: '2026-04-11T10:00:00.000Z',
                updatedAt: '2026-04-11T10:00:00.000Z',
            },
            {
                _id: '67f6e045a7125d4ab7c0af45',
                vendorId: '67f6df0aa7125d4ab7c0af10',
                kind: 'image',
                url: 'https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/hero-2.jpg',
                thumbnailUrl: 'https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/hero-2.jpg',
                publicId: 'flamigo/products/vendor-a/hero-2',
                mimeType: 'image/jpeg',
                format: 'jpg',
                sizeBytes: 221904,
                originalName: 'hero-2.jpg',
                status: 'ready',
                createdAt: '2026-04-11T10:00:00.000Z',
                updatedAt: '2026-04-11T10:00:00.000Z',
            },
            {
                _id: '67f6e055a7125d4ab7c0af55',
                vendorId: '67f6df0aa7125d4ab7c0af10',
                kind: 'model_3d',
                url: 'https://res.cloudinary.com/flamigo/raw/upload/v1/flamigo/products/vendor-a/chair.glb',
                thumbnailUrl: 'https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/chair-poster.jpg',
                publicId: 'flamigo/products/vendor-a/chair',
                mimeType: 'model/gltf-binary',
                format: 'glb',
                sizeBytes: 1932812,
                originalName: 'chair.glb',
                posterUrl: 'https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/chair-poster.jpg',
                posterPublicId: 'flamigo/products/vendor-a/chair-poster',
                status: 'ready',
                createdAt: '2026-04-11T10:00:00.000Z',
                updatedAt: '2026-04-11T10:00:00.000Z',
            },
        ],
    },
};

const publicListProductsRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Products'],
    summary: 'List published products',
    description:
        'Returns active products with full pricing, characteristics, media, and optional 3D asset metadata.',
    request: {
        query: z.object({
            page: z.coerce.number().default(1),
            limit: z.coerce.number().default(20),
            search: z.string().optional(),
            category: z.string().optional(),
            subcategory: z.string().optional(),
            vendorId: z.string().optional(),
        }),
    },
    responses: {
        200: {
            description: 'Products returned',
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

productsRouter.openapi(publicListProductsRoute, fetchProductsController as any);

const suggestProductsRoute = createRoute({
    method: 'get',
    path: '/search/suggest',
    tags: ['Products'],
    summary: 'Autocomplete product search suggestions',
    description:
        'Returns lightweight product suggestions for search bars and autocomplete, including current promo-aware price previews.',
    request: {
        query: z.object({
            q: z.string().min(1),
            limit: z.coerce.number().min(1).max(10).default(8),
        }),
    },
    responses: {
        200: {
            description: 'Suggestions returned',
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
    },
});

productsRouter.openapi(suggestProductsRoute, suggestProductsController as any);

const getProductRoute = createRoute({
    method: 'get',
    path: '/{identifier}',
    tags: ['Products'],
    summary: 'Get a published product by id or slug',
    request: {
        params: z.object({
            identifier: z.string().min(1),
        }),
    },
    responses: {
        200: {
            description: 'Product returned',
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
        404: { description: 'Product not found' },
    },
});

const vendorListProductsRoute = createRoute({
    method: 'get',
    path: '/vendor/mine',
    tags: ['Products — Vendor'],
    summary: 'List products owned by the authenticated vendor',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            page: z.coerce.number().default(1),
            limit: z.coerce.number().default(20),
            search: z.string().optional(),
            category: z.string().optional(),
            subcategory: z.string().optional(),
            status: z.enum(['draft', 'active', 'archived']).optional(),
        }),
    },
    responses: {
        200: {
            description: 'Vendor products returned',
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
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
    },
});

const uploadProductMediaRoute = createRoute({
    method: 'post',
    path: '/vendor/media-assets',
    tags: ['Products — Vendor'],
    summary: 'Upload vendor product media assets',
    description:
        'Uploads media before product creation. At least one image is required for every product, and you can upload multiple images for a single product. Optional 3D files and poster images can be uploaded alongside those images. The response returns every uploaded asset with its persisted URLs, including `url`, optional `thumbnailUrl`, and optional `posterUrl`.',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'multipart/form-data': {
                    example: uploadProductMediaRequestExample,
                    schema: z.object({
                        images: requiredMultipartImageFilesSchema,
                        threeDAssets: multipartThreeDAssetFilesSchema,
                        threeDPosterImages: multipartThreeDPosterFilesSchema,
                    }),
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Media assets uploaded',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.object({
                            assets: z.array(productMediaAssetSchema),
                        }),
                    }).openapi({
                        example: uploadProductMediaResponseExample,
                    }),
                },
            },
        },
        400: { description: 'Validation error or unsupported media file' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
    },
});

const createProductRoute = createRoute({
    method: 'post',
    path: '/vendor',
    tags: ['Products — Vendor'],
    summary: 'Create a product as a vendor',
    description:
        'Creates a product from a JSON payload after media assets have already been uploaded. Pass `mediaAssetIds` from the dedicated upload endpoint so the product stores a display-ready `media` array with persisted URLs, poster URLs, and thumbnail URLs. The referenced assets must include at least one uploaded image, and multiple image assets are supported. If you already created a vendor product promo (`POST /api/v1/promos`), pass `promoId` to set `activePromoId` in one step instead of calling the promo attach endpoint after creation.',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    example: createProductRequestExample,
                    schema: z.object({
                        name: z.string().min(2),
                        slug: z.string().optional(),
                        description: z.string().min(10),
                        shortDescription: z.string().optional(),
                        brand: z.string().optional(),
                        category: z.string().min(2),
                        subcategory: z.string().optional(),
                        tags: z.array(z.string()).optional(),
                        characteristics: z.array(z.any()).min(1),
                        pricing: z.any(),
                        inventory: z.any(),
                        dimensions: z.any().optional(),
                        mediaAssetIds: z.array(z.string().length(24)).optional(),
                        primaryMediaAssetId: z.string().length(24).optional(),
                        promoId: z.string().length(24).optional().openapi({
                            description:
                                'Optional. ID of your own vendor `scope: "product"` promo. Sets the product active promo without a separate attach request.',
                        }),
                        status: z.enum(['draft', 'active', 'archived']).optional(),
                    }).openapi({
                        example: createProductRequestExample,
                    }),
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Product created',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.object({
                            product: productResponseSchema,
                        }),
                    }).openapi({
                        example: {
                            success: true,
                            message: 'Product created successfully.',
                            data: {
                                product: {
                                    _id: '67f6e0b5a7125d4ab7c0af91',
                                    vendorId: '67f6df0aa7125d4ab7c0af10',
                                    name: 'Premium Sneaker',
                                    slug: 'premium-sneaker',
                                    description: 'Lightweight sneaker with breathable mesh upper.',
                                    category: 'Footwear',
                                    tags: [],
                                    characteristics: [
                                        { name: 'Color', value: 'Black', highlighted: true },
                                    ],
                                    pricing: {
                                        currency: 'NGN',
                                        amount: 45000,
                                        cost: 30000,
                                        taxInclusive: false,
                                        promos: [],
                                    },
                                    inventory: {
                                        quantity: 15,
                                        lowStockThreshold: 3,
                                        allowBackorder: false,
                                    },
                                    media: [
                                        {
                                            assetId: '67f6e044a7125d4ab7c0af44',
                                            kind: 'image',
                                            url: 'https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/hero.jpg',
                                            thumbnailUrl: 'https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/hero.jpg',
                                            publicId: 'flamigo/products/vendor-a/hero',
                                            mimeType: 'image/jpeg',
                                            format: 'jpg',
                                            sizeBytes: 248132,
                                            originalName: 'hero.jpg',
                                            sortOrder: 0,
                                            isPrimary: true,
                                        },
                                        {
                                            assetId: '67f6e055a7125d4ab7c0af45',
                                            kind: 'model_3d',
                                            url: 'https://res.cloudinary.com/flamigo/raw/upload/v1/flamigo/products/vendor-a/chair.glb',
                                            thumbnailUrl: 'https://res.cloudinary.com/flamigo/image/upload/c_fill,g_auto,h_800,q_auto,w_800/v1/flamigo/products/vendor-a/chair-preview.jpg',
                                            publicId: 'flamigo/products/vendor-a/chair',
                                            mimeType: 'model/gltf-binary',
                                            format: 'glb',
                                            sizeBytes: 1932812,
                                            originalName: 'chair.glb',
                                            sortOrder: 1,
                                            isPrimary: false,
                                            posterUrl: 'https://res.cloudinary.com/flamigo/image/upload/v1/flamigo/products/vendor-a/chair-preview.jpg',
                                            posterPublicId: 'flamigo/products/vendor-a/chair-preview',
                                        },
                                    ],
                                    status: 'draft',
                                    version: 0,
                                    createdAt: '2026-04-11T10:00:00.000Z',
                                    updatedAt: '2026-04-11T10:00:00.000Z',
                                },
                            },
                        },
                    }),
                },
            },
        },
        400: { description: 'Validation error' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
    },
});

const updateProductRoute = createRoute({
    method: 'patch',
    path: '/vendor/{productId}',
    tags: ['Products — Vendor'],
    summary: 'Update a vendor product with optimistic locking',
    description:
        'Updates a vendor product using JSON only. Upload new media first through `/vendor/media-assets`, then pass `appendMediaAssetIds` here to attach them. A product must always retain at least one image, although multiple images are supported. The update is rejected with `409` if another request already modified the product, preventing race-condition overwrites.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            productId: z.string().length(24),
        }),
        body: {
            content: {
                'application/json': {
                    example: updateProductRequestExample,
                    schema: z.object({
                        version: z.number().int().nonnegative(),
                        name: z.string().optional(),
                        slug: z.string().optional(),
                        description: z.string().optional(),
                        shortDescription: z.string().optional(),
                        brand: z.string().optional(),
                        category: z.string().optional(),
                        subcategory: z.string().optional(),
                        tags: z.array(z.string()).optional(),
                        characteristics: z.array(z.any()).optional(),
                        pricing: z.any().optional(),
                        inventory: z.any().optional(),
                        dimensions: z.any().optional(),
                        appendMediaAssetIds: z.array(z.string().length(24)).optional(),
                        primaryMediaAssetId: z.string().length(24).optional(),
                        removeMediaPublicIds: z.array(z.string()).optional(),
                        primaryMediaPublicId: z.string().optional(),
                        status: z.enum(['draft', 'active', 'archived']).optional(),
                    }).openapi({
                        example: updateProductRequestExample,
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Product updated',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        data: z.object({
                            product: productResponseSchema,
                        }),
                    }),
                },
            },
        },
        400: { description: 'Validation error' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        404: { description: 'Product not found' },
        409: { description: 'Version conflict' },
    },
});

productsRouter.use('/vendor', ensureDatabaseConnected);
productsRouter.use('/vendor/*', ensureDatabaseConnected);
productsRouter.use('/vendor', requireRole([ROLE_NAMES.VENDOR]));
productsRouter.use('/vendor/*', requireRole([ROLE_NAMES.VENDOR]));
productsRouter.use('/vendor', async (context, next) => {
  if (context.req.method === 'GET') {
    await next();
    return;
  }
  await requireVendorPayoutSetup()(context, next);
});
productsRouter.use('/vendor/*', async (context, next) => {
  if (context.req.method === 'GET') {
    await next();
    return;
  }
  await requireVendorPayoutSetup()(context, next);
});

productsRouter.openapi(vendorListProductsRoute, fetchVendorProductsController as any);
productsRouter.get('/vendor/overview', fetchVendorProductsOverviewController as any);
productsRouter.get('/vendor/hub-stats', fetchVendorHubStatsController as any);
productsRouter.get('/vendor/:productId/analytics', fetchVendorProductAnalyticsController as any);
productsRouter.openapi(uploadProductMediaRoute, uploadProductMediaController as any);
productsRouter.openapi(createProductRoute, createProductController as any);
productsRouter.openapi(updateProductRoute, updateProductController as any);
productsRouter.openapi(getProductRoute, fetchProductController as any);
