import { z } from 'zod';

export const storeAddressSchema = z.object({
  formattedAddress: z.string().trim().max(500).optional(),
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(32).optional(),
});

export const storeLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  address: storeAddressSchema.optional(),
  location: storeLocationSchema.optional(),
  googlePlaceId: z.string().trim().max(200).optional(),
});

export const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().url().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  address: storeAddressSchema.nullable().optional(),
  location: storeLocationSchema.nullable().optional(),
  googlePlaceId: z.string().trim().max(200).nullable().optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export const assignStoreProductsSchema = z.object({
  productIds: z.array(z.string().length(24)).min(1).max(100),
  action: z.enum(['assign', 'unassign', 'publish']).default('assign'),
  publish: z.boolean().optional().default(false),
});

export const updateStoreProductInventorySchema = z.object({
  quantity: z.number().int().nonnegative(),
});

export const assignStoreManagerSchema = z.object({
  userId: z.string().length(24),
  role: z.enum(['manager', 'streamer']).default('manager'),
});

export const fetchPublicStorefrontsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  productsPerStore: z.coerce.number().int().min(1).max(24).default(8),
});

export type CreateStorePayload = z.infer<typeof createStoreSchema>;
export type AssignStoreManagerPayload = z.infer<typeof assignStoreManagerSchema>;
export type FetchPublicStorefrontsQuery = z.infer<typeof fetchPublicStorefrontsQuerySchema>;
