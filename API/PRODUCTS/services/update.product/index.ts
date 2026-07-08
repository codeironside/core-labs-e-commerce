import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { Product } from '../../models/index.js';
import { updateProductPayloadSchema } from '../../schemas/index.js';
import {
    attachMediaAssetsToProduct,
    buildProductMediaFromAssets,
    ensureUniqueSlug,
    hasAtLeastOneImageMedia,
    mergeProductMedia,
    normalizeCharacteristics,
    normalizeDimensions,
    normalizeInventory,
    normalizePricing,
    releaseMediaAssetsFromProduct,
    resolveVendorMediaAssets,
} from '../../utils/index.js';
import { buildProductSnapshot, detectChangedFields, recordProductVersion } from '../../utils/productVersion.js';

export const updateProductController = async (c: Context) => {
    try {
        const sessionUser = c.get('user');
        if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

        const vendorId = sessionUser.userId;
        const productId = c.req.param('productId');
        if (!productId) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
        }
        const existingProduct = await Product.findOne({ _id: productId, vendorId }).lean();

        if (!existingProduct) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
        }

        const body = await c.req.json().catch(() => ({}));
        const parsed = updateProductPayloadSchema.safeParse(body);

        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
                400,
            );
        }

        const updateData: Record<string, unknown> = {};
        const payload = parsed.data;
        const appendedAssets = await resolveVendorMediaAssets(
            vendorId,
            payload.appendMediaAssetIds,
            String(existingProduct._id),
        );
        const appendedMedia = buildProductMediaFromAssets(
            appendedAssets,
            payload.primaryMediaAssetId,
        );
        const desiredPrimaryPublicId =
            payload.primaryMediaPublicId ??
            [...existingProduct.media, ...appendedMedia].find(
                (item) => String(item.assetId ?? '') === String(payload.primaryMediaAssetId ?? ''),
            )?.publicId;
        const removedMedia = existingProduct.media.filter((item) =>
            payload.removeMediaPublicIds.includes(item.publicId),
        );

        if (payload.name !== undefined) updateData.name = payload.name;
        if (payload.description !== undefined) updateData.description = payload.description;
        if (payload.shortDescription !== undefined) updateData.shortDescription = payload.shortDescription;
        if (payload.brand !== undefined) updateData.brand = payload.brand;
        if (payload.category !== undefined) updateData.category = payload.category;
        if (payload.subcategory !== undefined) updateData.subcategory = payload.subcategory;
        if (payload.tags !== undefined) updateData.tags = payload.tags;
        if (payload.characteristics !== undefined) {
            updateData.characteristics = normalizeCharacteristics(payload.characteristics);
        }
        if (payload.pricing !== undefined) updateData.pricing = normalizePricing(payload.pricing);
        if (payload.inventory !== undefined) updateData.inventory = normalizeInventory(payload.inventory);
        if (payload.dimensions !== undefined) updateData.dimensions = normalizeDimensions(payload.dimensions);
        if (payload.status !== undefined) {
            updateData.status = payload.status;
            if (payload.status === 'active' && !existingProduct.publishedAt) {
                updateData.publishedAt = new Date();
            }
        }

        if (payload.slug !== undefined || payload.name !== undefined) {
            updateData.slug = await ensureUniqueSlug(
                payload.slug ?? payload.name ?? existingProduct.name,
                String(existingProduct._id),
            );
        }

        const mergedMedia = mergeProductMedia(
            existingProduct.media,
            appendedMedia,
            payload.removeMediaPublicIds,
            desiredPrimaryPublicId,
        );
        updateData.media = mergedMedia;

        if (!hasAtLeastOneImageMedia(mergedMedia)) {
            throw new AppError(
                'A product must always keep at least one image. You can upload multiple images per product.',
                400,
            );
        }

        if (payload.auctionSettings !== undefined) {
            updateData.auctionSettings = payload.auctionSettings;
        }

        const nextSnapshotSource = {
            name: (updateData.name as string | undefined) ?? existingProduct.name,
            description: (updateData.description as string | undefined) ?? existingProduct.description,
            shortDescription: (updateData.shortDescription as string | undefined) ?? existingProduct.shortDescription,
            category: (updateData.category as string | undefined) ?? existingProduct.category,
            subcategory: (updateData.subcategory as string | undefined) ?? existingProduct.subcategory,
            pricing: (updateData.pricing as typeof existingProduct.pricing | undefined) ?? existingProduct.pricing,
            characteristics:
                (updateData.characteristics as typeof existingProduct.characteristics | undefined) ??
                existingProduct.characteristics,
            media: mergedMedia,
        };
        const changedFields = detectChangedFields(existingProduct, nextSnapshotSource);

        const updatedProduct = await Product.findOneAndUpdate(
            { _id: productId, vendorId, version: payload.version },
            {
                $set: updateData,
                $inc: { version: 1 },
            },
            { new: true },
        ).lean();

        if (!updatedProduct) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_VERSION_CONFLICT, 409);
        }

        if (changedFields.length > 0) {
            await recordProductVersion({
                productId: updatedProduct._id,
                versionNumber: updatedProduct.version,
                snapshot: buildProductSnapshot(nextSnapshotSource),
                changedFields,
                createdBy: vendorId,
            });
        }

        await attachMediaAssetsToProduct(payload.appendMediaAssetIds, productId);
        await releaseMediaAssetsFromProduct(removedMedia, productId);

        logger.info(
            {
                vendorId,
                productId,
                previousVersion: payload.version,
                nextVersion: updatedProduct.version,
            },
            'Vendor product updated with optimistic locking',
        );

        // Check if there is an active livestream that lists this product, and broadcast an update
        try {
            const { LivestreamSession } = await import('../../../LIVESTREAMS/models/index.js');
            const { publishLivestreamEvent } = await import('../../../../CORE/services/realtime/index.js');
            
            const activeStream = await LivestreamSession.findOne({ 
                vendorId, 
                status: 'active',
                listedProductIds: productId
            }).select('_id').lean();

            if (activeStream) {
                await publishLivestreamEvent(String(activeStream._id), {
                    type: 'product.updated',
                    livestreamId: String(activeStream._id),
                    product: { ...updatedProduct } as Record<string, unknown>,
                });
            }
        } catch (err) {
            logger.warn({ err, productId }, 'Failed to broadcast product update to livestream');
        }

        return ResponseHandler.success(
            c,
            SYSTEM_MESSAGES.SUCCESS.PRODUCT_UPDATED,
            { product: updatedProduct },
        );
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error({ error }, 'Failed to update product');
        throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_UPDATE_FAILED, 500);
    }
};
