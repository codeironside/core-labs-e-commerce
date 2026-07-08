import { z } from 'zod';

export const createLivestreamSchema = z.object({
    title: z.string().min(3).max(160),
    description: z.string().max(2000).optional(),
    storeId: z.string().length(24).optional(),
    productId: z.string().length(24).optional(),
    listedProductIds: z.array(z.string().length(24)).optional().default([]),
    recordingEnabled: z.boolean().optional().default(false),
    tokenExpirySeconds: z.number().int().min(3600).max(86400).optional().default(86400),
    coverImageUrl: z.string().url().optional(),
    coverImagePublicId: z.string().max(200).optional(),
});

export const fetchVendorLivestreamsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    productId: z.string().length(24).optional(),
});

export const createAuctionSchema = z.object({
    productId: z.string().length(24),
    startingBid: z.number().nonnegative(),
    minimumIncrement: z.number().positive(),
    bidInactivitySeconds: z.number().int().min(10).max(300),
});

export const placeBidSchema = z.object({
    amount: z.number().positive(),
});

export const createCommentSchema = z.object({
    message: z.string().trim().min(1).max(1000),
});

export const fetchLivestreamCommentsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CreateLivestreamPayload = z.infer<typeof createLivestreamSchema>;
export type FetchVendorLivestreamsQuery = z.infer<typeof fetchVendorLivestreamsQuerySchema>;
export type CreateAuctionPayload = z.infer<typeof createAuctionSchema>;
export type PlaceBidPayload = z.infer<typeof placeBidSchema>;
export type CreateCommentPayload = z.infer<typeof createCommentSchema>;
export type FetchLivestreamCommentsQuery = z.infer<typeof fetchLivestreamCommentsQuerySchema>;
