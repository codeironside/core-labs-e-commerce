import type { Context } from "hono";
import { logger } from "../../../../CORE/services/logger/index.js";
import { ResponseHandler } from "../../../../CORE/handlers/response/index.js";
import { AppError } from "../../../../CORE/handlers/error/index.js";
import { SYSTEM_MESSAGES } from "../../../../CORE/utils/constants/index.js";
import {
  hasAtLeastOneImageAsset,
  normalizeFiles,
  uploadProductMediaAssets,
} from "../../utils/index.js";

export const uploadProductMediaController = async (c: Context) => {
  try {
    const sessionUser = c.get("user");
    if (!sessionUser)
      throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const vendorId = sessionUser.userId;

    const formData = await c.req.parseBody({ all: true });
    const imageFiles = normalizeFiles(formData.images);
    const threeDFiles = normalizeFiles(formData.threeDAssets);
    const posterFiles = normalizeFiles(formData.threeDPosterImages);

    if (imageFiles.length === 0) {
      throw new AppError(
        "At least one product image is required. You can upload multiple images per product.",
        400,
      );
    }

    if (posterFiles.length > threeDFiles.length) {
      throw new AppError(
        "threeDPosterImages cannot exceed the number of uploaded threeDAssets",
        400,
      );
    }

    const assets = await uploadProductMediaAssets(
      vendorId,
      imageFiles,
      threeDFiles,
      posterFiles,
    );

    if (!hasAtLeastOneImageAsset(assets)) {
      throw new AppError(
        "At least one product image is required. You can upload multiple images per product.",
        400,
      );
    }

    logger.info(
      {
        vendorId,
        assetCount: assets.length,
        imageCount: imageFiles.length,
        threeDCount: threeDFiles.length,
        posterCount: posterFiles.length,
      },
      "Vendor product media assets uploaded",
    );

    return ResponseHandler.success(
      c,
      SYSTEM_MESSAGES.SUCCESS.PRODUCT_MEDIA_ASSETS_UPLOADED,
      { assets },
      undefined,
      201,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, "Failed to upload product media assets");
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_MEDIA_UPLOAD_FAILED, 500);
  }
};
