import type { Context } from "hono";
import mongoose from "mongoose";
import { logger } from "../../../../CORE/services/logger/index.js";
import { ResponseHandler } from "../../../../CORE/handlers/response/index.js";
import { AppError } from "../../../../CORE/handlers/error/index.js";
import { SYSTEM_MESSAGES } from "../../../../CORE/utils/constants/index.js";
import { Promo } from "../../../PROMOS/models/index.js";
import { isPromoLive } from "../../../PROMOS/utils/index.js";
import { Product } from "../../models/index.js";
import { createProductPayloadSchema } from "../../schemas/index.js";
import {
  attachMediaAssetsToProduct,
  buildProductMediaFromAssets,
  ensureUniqueSlug,
  hasAtLeastOneImageAsset,
  normalizeCharacteristics,
  normalizeDimensions,
  normalizeInventory,
  normalizePricing,
  resolveVendorMediaAssets,
} from "../../utils/index.js";
import { buildProductSnapshot, recordProductVersion } from "../../utils/productVersion.js";
import { resolveVendorOwnedStoreId } from "../../../STORES/utils/resolveVendorStore.js";
import { dispatchVendorProductNotification } from "../dispatch.vendor.product.notification/index.js";

export const createProductController = async (c: Context) => {
  try {
    const sessionUser = c.get("user");
    if (!sessionUser)
      throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const vendorId = sessionUser.userId;

    const body = await c.req.json().catch(() => ({}));
    const parsed = createProductPayloadSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ??
          SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    const mediaAssets = await resolveVendorMediaAssets(
      vendorId,
      parsed.data.mediaAssetIds,
    );
    const media = buildProductMediaFromAssets(
      mediaAssets,
      parsed.data.primaryMediaAssetId,
    );

    if (!hasAtLeastOneImageAsset(mediaAssets)) {
      throw new AppError(
        "A product must include at least one uploaded image asset. Multiple images are allowed.",
        400,
      );
    }

    const slug = await ensureUniqueSlug(parsed.data.slug ?? parsed.data.name);
    const characteristics = normalizeCharacteristics(
      parsed.data.characteristics,
    );
    const pricing = normalizePricing(parsed.data.pricing);
    const inventory = normalizeInventory(parsed.data.inventory);
    const dimensions = normalizeDimensions(parsed.data.dimensions);

    let activePromoId: mongoose.Types.ObjectId | undefined;
    if (parsed.data.promoId) {
      const promo = await Promo.findById(parsed.data.promoId);
      if (!promo)
        throw new AppError(SYSTEM_MESSAGES.ERRORS.PROMO_NOT_FOUND, 404);

      if (String(promo.createdBy) !== vendorId) {
        throw new AppError("You can only attach your own promos.", 403);
      }
      if (promo.creatorRole !== "vendor") {
        throw new AppError(
          "Only vendor-created promos can be set when creating a product.",
          400,
        );
      }
      if (promo.scope !== "product") {
        throw new AppError(
          "Only product-scoped promos can be attached to a product.",
          400,
        );
      }
      if (promo.isLogisticsPromo) {
        throw new AppError(
          "Logistics promos cannot be attached to a product.",
          400,
        );
      }
      if (promo.approvalStatus !== "approved") {
        throw new AppError("This promo has not been approved yet.", 400);
      }
      if (!isPromoLive(promo)) {
        throw new AppError(
          "This promo is not currently active or has expired.",
          400,
        );
      }
      if (
        promo.type === "fixed" &&
        promo.currency &&
        promo.currency !== pricing.currency
      ) {
        throw new AppError(
          "Promo currency must match the product pricing currency.",
          400,
        );
      }

      activePromoId = promo._id as mongoose.Types.ObjectId;
    }

    const resolvedStoreId = parsed.data.storeId
      ? await resolveVendorOwnedStoreId(vendorId, parsed.data.storeId)
      : undefined;

    const productData = {
      vendorId: new mongoose.Types.ObjectId(vendorId),
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      slug,
      tags: parsed.data.tags,
      characteristics,
      pricing,
      inventory,
      status: parsed.data.status,
      media,
      ...(resolvedStoreId ? { storeId: resolvedStoreId } : {}),
      ...(parsed.data.shortDescription
        ? { shortDescription: parsed.data.shortDescription }
        : {}),
      ...(parsed.data.brand ? { brand: parsed.data.brand } : {}),
      ...(parsed.data.subcategory
        ? { subcategory: parsed.data.subcategory }
        : {}),
      ...(dimensions ? { dimensions } : {}),
      ...(activePromoId ? { activePromoId } : {}),
      ...(parsed.data.status === "active" ? { publishedAt: new Date() } : {}),
    };

    const product = await Product.create(productData as Record<string, unknown>);

    await recordProductVersion({
      productId: product._id,
      versionNumber: 0,
      snapshot: buildProductSnapshot({
        name: product.name,
        description: product.description,
        shortDescription: product.shortDescription,
        category: product.category,
        subcategory: product.subcategory,
        pricing: product.pricing,
        characteristics: product.characteristics,
        media: product.media,
      }),
      changedFields: ['initial'],
      createdBy: vendorId,
    });

    if (activePromoId) {
      await Promo.findByIdAndUpdate(activePromoId, {
        $addToSet: { productIds: product._id },
      });
    }

    await attachMediaAssetsToProduct(
      parsed.data.mediaAssetIds,
      String(product._id),
    );

    logger.info(
      {
        vendorId,
        productId: String(product._id),
        mediaCount: media.length,
        characteristicsCount: parsed.data.characteristics.length,
      },
      "Vendor product created",
    );

    try {
      await dispatchVendorProductNotification({
        vendorId,
        productId: String(product._id),
        productName: product.name,
        status: parsed.data.status,
        ...(resolvedStoreId ? { storeId: String(resolvedStoreId) } : {}),
      });
    } catch (notificationError) {
      logger.warn(
        { notificationError, vendorId, productId: String(product._id) },
        "[Products] Vendor product notification failed — product still created",
      );
    }

    return ResponseHandler.success(
      c,
      SYSTEM_MESSAGES.SUCCESS.PRODUCT_CREATED,
      { product },
      undefined,
      201,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, "Failed to create product");
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_CREATE_FAILED, 500);
  }
};
