import { z } from 'zod';
import { FIAT_CURRENCIES } from '../../../CORE/utils/constants/index.js';


export const productStatusSchema = z.enum(['draft', 'active', 'archived']);

export const productCharacteristicSchema = z.object({
    name: z.string().min(1).max(120),
    value: z.string().min(1).max(300),
    group: z.string().max(120).optional(),
    unit: z.string().max(30).optional(),
    description: z.string().max(300).optional(),
    highlighted: z.boolean().optional().default(false),
});

export const productPricingSchema = z
    .object({
        currency: z.enum(FIAT_CURRENCIES).default('NGN').openapi({
            example: 'NGN',
            description: 'ISO 4217 currency code for this product price. Must be one of the platform supported fiat currencies.',
        }),
        amount: z.number().nonnegative(),
        compareAtAmount: z.number().nonnegative().optional(),
        cost: z.number().nonnegative(),
        taxInclusive: z.boolean().optional().default(false),
    })
    .superRefine((value, ctx) => {
        if (value.compareAtAmount !== undefined && value.compareAtAmount < value.amount) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['compareAtAmount'],
                message: 'compareAtAmount cannot be lower than amount',
            });
        }
    });

export const productInventorySchema = z.object({
    sku: z.string().max(120).optional(),
    barcode: z.string().max(120).optional(),
    quantity: z.number().int().nonnegative(),
    lowStockThreshold: z.number().int().nonnegative().optional().default(0),
    allowBackorder: z.boolean().optional().default(false),
});

export const productDimensionsSchema = z.object({
    weightKg: z.number().nonnegative().optional(),
    lengthCm: z.number().nonnegative().optional(),
    widthCm: z.number().nonnegative().optional(),
    heightCm: z.number().nonnegative().optional(),
});

export const productMediaAssetIdSchema = z.string().length(24);

const createProductPayloadBaseSchema = z.object({
    name: z.string().min(2).max(160),
    slug: z.string().min(2).max(200).optional(),
    description: z.string().min(10).max(5000),
    shortDescription: z.string().max(280).optional(),
    brand: z.string().max(120).optional(),
    category: z.string().min(2).max(120),
    subcategory: z.string().max(120).optional(),
    tags: z.array(z.string().min(1).max(60)).optional().default([]),
    characteristics: z.array(productCharacteristicSchema).min(1),
    pricing: productPricingSchema,
    inventory: productInventorySchema,
    dimensions: productDimensionsSchema.optional(),
    mediaAssetIds: z.array(productMediaAssetIdSchema).optional().default([]),
    primaryMediaAssetId: productMediaAssetIdSchema.optional(),
    storeId: z.string().length(24).optional(),
    status: productStatusSchema.optional().default('draft'),
});

export const createProductPayloadSchema = createProductPayloadBaseSchema
    .extend({
        promoId: productMediaAssetIdSchema.optional(),
    })
    .superRefine((value, ctx) => {
        if (
            value.primaryMediaAssetId &&
            !value.mediaAssetIds.includes(value.primaryMediaAssetId)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['primaryMediaAssetId'],
                message: 'primaryMediaAssetId must be included in mediaAssetIds',
            });
        }
        if (value.inventory.quantity < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['inventory', 'quantity'],
                message: 'Inventory quantity must be at least 2',
            });
        }
    });

export const updateProductPayloadSchema = createProductPayloadBaseSchema
    .partial()
    .extend({
        version: z.number().int().nonnegative(),
        appendMediaAssetIds: z.array(productMediaAssetIdSchema).optional().default([]),
        primaryMediaAssetId: productMediaAssetIdSchema.optional(),
        removeMediaPublicIds: z.array(z.string().min(1)).optional().default([]),
        primaryMediaPublicId: z.string().min(1).optional(),
    })
    .refine(
        (value) =>
            value.name !== undefined ||
            value.slug !== undefined ||
            value.description !== undefined ||
            value.shortDescription !== undefined ||
            value.brand !== undefined ||
            value.category !== undefined ||
            value.subcategory !== undefined ||
            value.tags !== undefined ||
            value.characteristics !== undefined ||
            value.pricing !== undefined ||
            value.inventory !== undefined ||
            value.dimensions !== undefined ||
            value.status !== undefined ||
            (value.appendMediaAssetIds?.length ?? 0) > 0 ||
            (value.removeMediaPublicIds?.length ?? 0) > 0 ||
            value.primaryMediaAssetId !== undefined ||
            value.primaryMediaPublicId !== undefined,
        {
            message: 'At least one product field must be provided for update',
        }
    );

export const fetchProductsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(200).optional(),
    category: z.string().max(120).optional(),
    subcategory: z.string().max(120).optional(),
    vendorId: z.string().length(24).optional(),
});

export const fetchVendorProductsQuerySchema = fetchProductsQuerySchema.extend({
    status: productStatusSchema.optional(),
});

export const suggestProductsQuerySchema = z.object({
    q: z.string().trim().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(10).default(8),
});

export type CreateProductPayload = z.infer<typeof createProductPayloadSchema>;
export type UpdateProductPayload = z.infer<typeof updateProductPayloadSchema>;
export type FetchProductsQuery = z.infer<typeof fetchProductsQuerySchema>;
export type FetchVendorProductsQuery = z.infer<typeof fetchVendorProductsQuerySchema>;
export type SuggestProductsQuery = z.infer<typeof suggestProductsQuerySchema>;
