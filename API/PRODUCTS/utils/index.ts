import mongoose from 'mongoose';
import { cloudinary } from '../../../CORE/services/storage/index.js';
import { AppError } from '../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../CORE/utils/constants/index.js';
import {
    Product,
    ProductMediaAsset,
    type IProductCharacteristic,
    type IProductDimensions,
    type IProductInventory,
    type IProductMedia,
    type IProductMediaAsset,
    type IProductPricing,
} from '../models/index.js';


type ProductWithPricing = {
    _id?: unknown;
    name?: string | undefined;
    category?: string | undefined;
    shortDescription?: string | undefined;
    inventory?: { quantity?: number | undefined } | undefined;
    pricing: IProductPricing;
    media?: ReadonlyArray<{
        url?: string | undefined;
        thumbnailUrl?: string | undefined;
    }> | undefined;
};

type CloudinaryUploadResult = {
    secure_url: string;
    public_id: string;
    format?: string;
};

type ProductMediaAssetRecord = IProductMediaAsset & {
    _id: mongoose.Types.ObjectId;
};

const SUPPORTED_3D_EXTENSIONS = new Set([
    'glb',
    'gltf',
    'usdz',
    'usd',
    'obj',
    'fbx',
    'stl',
]);

const extractExtension = (fileName: string) =>
    fileName.split('.').pop()?.trim().toLowerCase() ?? 'bin';

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildImageThumbnailUrl = (publicId: string) =>
    cloudinary.url(publicId, {
        secure: true,
        resource_type: 'image',
        transformation: [
            {
                width: 800,
                height: 800,
                crop: 'fill',
                gravity: 'auto',
                fetch_format: 'auto',
                quality: 'auto',
            },
        ],
    });

export const slugify = (value: string) =>
    normalizeWhitespace(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 200);

export const ensureUniqueSlug = async (
    rawValue: string,
    excludeProductId?: string,
) => {
    const baseSlug = slugify(rawValue);

    if (!baseSlug) {
        throw new AppError(SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED, 400);
    }

    let slug = baseSlug;
    let suffix = 1;

    while (true) {
        const existing = await Product.findOne({
            slug,
            ...(excludeProductId ? { _id: { $ne: excludeProductId } } : {}),
        })
            .select('_id')
            .lean();

        if (!existing) return slug;

        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
    }
};

export const getSingleFormValue = (
    value: FormDataEntryValue | FormDataEntryValue[] | undefined,
) => {
    if (Array.isArray(value)) return value[0];
    return value;
};

export const parseJsonFormField = <T>(
    value: FormDataEntryValue | FormDataEntryValue[] | undefined,
    fieldName: string,
): T => {
    const rawValue = getSingleFormValue(value);

    if (typeof rawValue !== 'string' || rawValue.trim() === '') {
        throw new AppError(`${fieldName} is required`, 400);
    }

    try {
        return JSON.parse(rawValue) as T;
    } catch {
        throw new AppError(`${fieldName} must be valid JSON`, 400);
    }
};

export const normalizeFiles = (
    value: FormDataEntryValue | FormDataEntryValue[] | undefined,
) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];

    return values.filter((entry): entry is File => entry instanceof File);
};

export const isImageFile = (file: File) => file.type.startsWith('image/');

export const isSupported3DFile = (file: File) => {
    if (file.type.startsWith('model/')) return true;

    const extension = extractExtension(file.name);
    return SUPPORTED_3D_EXTENSIONS.has(extension);
};

const uploadToCloudinary = async (
    file: File,
    options: {
        folder: string;
        resource_type: 'image' | 'raw';
        transformation?: Array<Record<string, unknown>>;
    },
) => {
    const buffer = Buffer.from(await file.arrayBuffer());

    const upload = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (error || !result) {
                    reject(error ?? new Error('Cloudinary upload failed'));
                    return;
                }

                resolve(result as CloudinaryUploadResult);
            },
        );

        uploadStream.end(buffer);
    });

    return upload;
};

const uniqueAssetIds = (assetIds: string[]) => Array.from(new Set(assetIds.filter(Boolean)));

export const uploadProductMediaAssets = async (
    vendorId: string,
    imageFiles: File[],
    threeDFiles: File[],
    posterFiles: File[],
): Promise<ProductMediaAssetRecord[]> => {
    const assets: Array<Omit<IProductMediaAsset, 'createdAt' | 'updatedAt'>> = [];
    const folder = `flamigo/products/${vendorId}`;

    for (const imageFile of imageFiles) {
        if (!isImageFile(imageFile)) {
            throw new AppError('All image uploads must be valid image files', 400);
        }

       
        const uploaded = await uploadToCloudinary(imageFile, {
            folder,
            resource_type: 'image',
        });

        assets.push({
            vendorId: new mongoose.Types.ObjectId(vendorId),
            kind: 'image',
            url: uploaded.secure_url,
            thumbnailUrl: buildImageThumbnailUrl(uploaded.public_id),
            publicId: uploaded.public_id,
            mimeType: imageFile.type || 'image/*',
            format: uploaded.format ?? extractExtension(imageFile.name),
            sizeBytes: imageFile.size,
            originalName: imageFile.name,
            status: 'ready',
        });
    }

    for (const [index, threeDFile] of threeDFiles.entries()) {
        if (!isSupported3DFile(threeDFile)) {
            throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_MEDIA_INVALID, 400);
        }

        const uploadedModel = await uploadToCloudinary(threeDFile, {
            folder,
            resource_type: 'raw',
        });

        let posterUrl: string | undefined;
        let posterPublicId: string | undefined;
        let thumbnailUrl: string | undefined;

        const posterFile = posterFiles[index];
        if (posterFile) {
            if (!isImageFile(posterFile)) {
                throw new AppError('3D poster files must be valid image files', 400);
            }

            const uploadedPoster = await uploadToCloudinary(posterFile, {
                folder,
                resource_type: 'image',
            });

            posterUrl = uploadedPoster.secure_url;
            posterPublicId = uploadedPoster.public_id;
            thumbnailUrl = buildImageThumbnailUrl(uploadedPoster.public_id);
        }

        assets.push({
            vendorId: new mongoose.Types.ObjectId(vendorId),
            kind: 'model_3d',
            url: uploadedModel.secure_url,
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
            publicId: uploadedModel.public_id,
            mimeType: threeDFile.type || `model/${extractExtension(threeDFile.name)}`,
            format: uploadedModel.format ?? extractExtension(threeDFile.name),
            sizeBytes: threeDFile.size,
            originalName: threeDFile.name,
            status: 'ready',
            ...(posterUrl ? { posterUrl } : {}),
            ...(posterPublicId ? { posterPublicId } : {}),
        });
    }

    if (assets.length === 0) {
        throw new AppError('At least one media file is required', 400);
    }

    const createdAssets = await ProductMediaAsset.insertMany(assets);
    return createdAssets.map((asset) => asset.toObject()) as ProductMediaAssetRecord[];
};

export const resolveVendorMediaAssets = async (
    vendorId: string,
    assetIds: string[],
    attachedProductId?: string,
): Promise<ProductMediaAssetRecord[]> => {
    const uniqueIds = uniqueAssetIds(assetIds);
    if (uniqueIds.length === 0) return [];

    if (uniqueIds.some((assetId) => !mongoose.isValidObjectId(assetId))) {
        throw new AppError(SYSTEM_MESSAGES.ERRORS.VALIDATION_FAILED, 400);
    }

    const assets = (await ProductMediaAsset.find({
        _id: { $in: uniqueIds },
        vendorId,
    }).lean()) as ProductMediaAssetRecord[];

    if (assets.length !== uniqueIds.length) {
        throw new AppError('One or more media assets were not found for this vendor', 400);
    }

    for (const asset of assets) {
        if (
            asset.status === 'attached' &&
            String(asset.attachedProductId ?? '') !== String(attachedProductId ?? '')
        ) {
            throw new AppError('One or more media assets are already attached to another product', 400);
        }
    }

    const assetMap = new Map(assets.map((asset) => [String(asset._id), asset]));
    return uniqueIds.map((assetId) => assetMap.get(assetId)!).filter(Boolean);
};

export const buildProductMediaFromAssets = (
    assets: ProductMediaAssetRecord[],
    primaryAssetId?: string,
): IProductMedia[] => {
    if (assets.length === 0) return [];

    const desiredPrimaryAssetId =
        primaryAssetId && assets.some((asset) => String(asset._id) === primaryAssetId)
            ? primaryAssetId
            : String(assets[0]?._id);

    return assets.map((asset, index) => ({
        assetId: asset._id,
        kind: asset.kind,
        url: asset.url,
        ...(asset.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}),
        publicId: asset.publicId,
        mimeType: asset.mimeType,
        format: asset.format,
        sizeBytes: asset.sizeBytes,
        originalName: asset.originalName,
        sortOrder: index,
        isPrimary: String(asset._id) === desiredPrimaryAssetId,
        ...(asset.posterUrl ? { posterUrl: asset.posterUrl } : {}),
        ...(asset.posterPublicId ? { posterPublicId: asset.posterPublicId } : {}),
    }));
};

export const hasAtLeastOneImageAsset = (assets: Array<Pick<IProductMediaAsset, 'kind'>>) =>
    assets.some((asset) => asset.kind === 'image');

export const hasAtLeastOneImageMedia = (media: Array<Pick<IProductMedia, 'kind'>>) =>
    media.some((item) => item.kind === 'image');

export const attachMediaAssetsToProduct = async (assetIds: string[], productId: string) => {
    const uniqueIds = uniqueAssetIds(assetIds);
    if (uniqueIds.length === 0) return;

    await ProductMediaAsset.updateMany(
        { _id: { $in: uniqueIds } },
        {
            $set: {
                status: 'attached',
                attachedProductId: new mongoose.Types.ObjectId(productId),
            },
        },
    );
};

export const releaseMediaAssetsFromProduct = async (media: IProductMedia[], productId: string) => {
    const assetIds = media
        .map((item) => item.assetId)
        .filter((value): value is mongoose.Types.ObjectId => Boolean(value))
        .map((value) => value.toString());

    const uniqueIds = uniqueAssetIds(assetIds);
    if (uniqueIds.length === 0) return;

    await ProductMediaAsset.updateMany(
        {
            _id: { $in: uniqueIds },
            attachedProductId: new mongoose.Types.ObjectId(productId),
        },
        {
            $set: { status: 'ready' },
            $unset: { attachedProductId: 1 },
        },
    );
};

export const mergeProductMedia = (
    existingMedia: IProductMedia[],
    newMedia: IProductMedia[],
    removeMediaPublicIds: string[],
    primaryMediaPublicId?: string,
) => {
    const removalSet = new Set(removeMediaPublicIds);
    const mergedMedia = [...existingMedia, ...newMedia].filter(
        (item) => !removalSet.has(item.publicId),
    );

    if (mergedMedia.length === 0) {
        return [];
    }

    const desiredPrimaryPublicId =
        primaryMediaPublicId && mergedMedia.some((item) => item.publicId === primaryMediaPublicId)
            ? primaryMediaPublicId
            : mergedMedia[0]?.publicId;

    return mergedMedia.map((item, index) => ({
        ...item,
        isPrimary: item.publicId === desiredPrimaryPublicId,
        sortOrder: index,
    }));
};

export const buildProductLookup = (identifier: string) => {
    const conditions: Array<Record<string, unknown>> = [{ slug: identifier.toLowerCase() }];

    if (mongoose.isValidObjectId(identifier)) {
        conditions.unshift({ _id: identifier });
    }

    return { $or: conditions };
};

export const normalizeCharacteristics = (
    characteristics: Array<{
        name: string;
        value: string;
        highlighted: boolean;
        group?: string | undefined;
        unit?: string | undefined;
        description?: string | undefined;
    }>,
): IProductCharacteristic[] =>
    characteristics.map((item) => ({
        name: item.name,
        value: item.value,
        highlighted: item.highlighted,
        ...(item.group ? { group: item.group } : {}),
        ...(item.unit ? { unit: item.unit } : {}),
        ...(item.description ? { description: item.description } : {}),
    }));

export const normalizePricing = (pricing: {
    currency: string;
    amount: number;
    cost: number;
    taxInclusive: boolean;
    compareAtAmount?: number | undefined;
}): IProductPricing => ({
    currency: pricing.currency,
    amount: pricing.amount,
    cost: pricing.cost,
    taxInclusive: pricing.taxInclusive,
    ...(pricing.compareAtAmount !== undefined
        ? { compareAtAmount: pricing.compareAtAmount }
        : {}),
});


export const normalizeInventory = (inventory: {
    quantity: number;
    lowStockThreshold: number;
    allowBackorder: boolean;
    sku?: string | undefined;
    barcode?: string | undefined;
}): IProductInventory => ({
    quantity: inventory.quantity,
    lowStockThreshold: inventory.lowStockThreshold,
    allowBackorder: inventory.allowBackorder,
    ...(inventory.sku ? { sku: inventory.sku } : {}),
    ...(inventory.barcode ? { barcode: inventory.barcode } : {}),
});

export const normalizeDimensions = (dimensions?: {
    weightKg?: number | undefined;
    lengthCm?: number | undefined;
    widthCm?: number | undefined;
    heightCm?: number | undefined;
}): IProductDimensions | undefined =>
    dimensions
        ? {
              ...(dimensions.weightKg !== undefined ? { weightKg: dimensions.weightKg } : {}),
              ...(dimensions.lengthCm !== undefined ? { lengthCm: dimensions.lengthCm } : {}),
              ...(dimensions.widthCm !== undefined ? { widthCm: dimensions.widthCm } : {}),
              ...(dimensions.heightCm !== undefined ? { heightCm: dimensions.heightCm } : {}),
          }
        : undefined;



export const buildComputedPricing = (pricing: IProductPricing) => {
    return {
        ...pricing,
        originalPrice: pricing.amount,
        discountedPrice: pricing.amount,
        hasActivePromo: false,
        activePromo: null,
        activePromos: [],
    };
};

export const serializeProduct = <T extends ProductWithPricing>(product: T) => ({
    ...product,
    pricing: buildComputedPricing(product.pricing),
});

export const serializeProducts = <T extends ProductWithPricing>(products: T[]) =>
    products.map((product) => serializeProduct(product));

export const extractPrimaryMediaUrl = (media: IProductMedia[] = []) =>
    media.find((item) => item.isPrimary)?.thumbnailUrl ??
    media.find((item) => item.isPrimary)?.posterUrl ??
    media.find((item) => item.isPrimary)?.url ??
    media[0]?.thumbnailUrl ??
    media[0]?.posterUrl ??
    media[0]?.url ??
    null;

export const escapeRegex = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
