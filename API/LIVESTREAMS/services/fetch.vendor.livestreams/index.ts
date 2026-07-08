import type { Context } from 'hono';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { ROLE_NAMES, SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { LivestreamSession } from '../../models/index.js';
import { Product } from '../../../PRODUCTS/models/index.js';
import { fetchVendorLivestreamsQuerySchema } from '../../schemas/index.js';
import { resolveCoverImageUrl } from '../../utils/coverImage.js';

const resolveStreamThumbnail = (
  metadata: unknown,
  listedProductIds: unknown[],
  productMap: Map<string, { media?: Array<{ isPrimary?: boolean; thumbnailUrl?: string }> }>,
): string | null => {
  const coverImageUrl = resolveCoverImageUrl(metadata);
  if (coverImageUrl) {
    return coverImageUrl;
  }

  const listedProducts = listedProductIds
    .map((productId) => productMap.get(String(productId)))
    .filter(Boolean);

  const primaryImage = listedProducts
    .flatMap((product) => product?.media ?? [])
    .find((media) => media.isPrimary)?.thumbnailUrl;

  if (primaryImage) {
    return primaryImage;
  }

  const fallbackImage = listedProducts.flatMap((product) => product?.media ?? [])[0]?.thumbnailUrl;
  return fallbackImage ?? null;
};

export const fetchVendorLivestreamsController = async (c: Context) => {
  try {
    const sessionUser = c.get('user');
    if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

    const vendorId = String(sessionUser.id ?? sessionUser._id);
    const vendor = await User.findById(vendorId).select('role userType').lean();

    if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
      throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
    }

    const parsed = fetchVendorLivestreamsQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED,
        400,
      );
    }

    const { page, limit, productId } = parsed.data;
    const skip = (page - 1) * limit;
    const filter = {
      vendorId,
      ...(productId ? { productId } : {}),
    };

    const [livestreams, total] = await Promise.all([
      LivestreamSession.find(filter)
        .select(
          'title status createdAt endedAt recordingUrl recordingPublic recordingEnabled adminRecordingOverride highlights listedProductIds metadata',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LivestreamSession.countDocuments(filter),
    ]);

    const allProductIds = livestreams.flatMap((stream) =>
      (stream.listedProductIds ?? []).map(String),
    );
    const uniqueProductIds = [...new Set(allProductIds)];
    const products = uniqueProductIds.length
      ? await Product.find({ _id: { $in: uniqueProductIds } }).select('_id media').lean()
      : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const enrichedLivestreams = livestreams.map((stream) => ({
      ...stream,
      coverImageUrl: resolveStreamThumbnail(
        stream.metadata,
        stream.listedProductIds ?? [],
        productMap,
      ),
    }));

    logger.info({ vendorId, total }, 'Vendor livestreams fetched');

    return ResponseHandler.success(
      c,
      SYSTEM_MESSAGES.SUCCESS.LIVESTREAMS_FETCHED,
      { livestreams: enrichedLivestreams },
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error }, 'Failed to fetch vendor livestreams');
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAMS_FETCH_FAILED, 500);
  }
};
