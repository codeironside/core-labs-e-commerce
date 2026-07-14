import mongoose, { type Document, type Model } from 'mongoose';

export type ProductStatus = 'draft' | 'active' | 'archived';
export type ProductMediaKind = 'image' | 'model_3d';
export type ProductMediaAssetStatus = 'ready' | 'attached';

export interface IProductCharacteristic {
    name: string;
    value: string;
    group?: string;
    unit?: string;
    description?: string;
    highlighted: boolean;
}

export interface IProductPricing {
    currency: string;
    amount: number;
    compareAtAmount?: number | undefined;
    cost: number;
    taxInclusive: boolean;
}

export interface IProductInventory {
    sku?: string;
    barcode?: string;
    quantity: number;
    lowStockThreshold: number;
    allowBackorder: boolean;
}

export interface IProductDimensions {
    weightKg?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
}

export interface IProductMedia {
    assetId?: mongoose.Types.ObjectId;
    kind: ProductMediaKind;
    url: string;
    thumbnailUrl?: string;
    publicId: string;
    mimeType: string;
    format: string;
    sizeBytes: number;
    originalName: string;
    altText?: string;
    sortOrder: number;
    isPrimary: boolean;
    posterUrl?: string;
    posterPublicId?: string;
}

export interface IProductMediaAsset {
    vendorId: mongoose.Types.ObjectId;
    kind: ProductMediaKind;
    url: string;
    thumbnailUrl?: string;
    publicId: string;
    mimeType: string;
    format: string;
    sizeBytes: number;
    originalName: string;
    posterUrl?: string;
    posterPublicId?: string;
    status: ProductMediaAssetStatus;
    attachedProductId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface IProductAuctionSettings {
    startingBid?: number;
    minimumIncrement?: number;
}

export interface IProduct {
    vendorId: mongoose.Types.ObjectId;
    storeId?: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    description: string;
    shortDescription?: string;
    brand?: string;
    category: string;
    subcategory?: string;
    tags: string[];
    characteristics: IProductCharacteristic[];
    pricing: IProductPricing;
    inventory: IProductInventory;
    dimensions?: IProductDimensions;
    media: IProductMedia[];
    activePromoId?: mongoose.Types.ObjectId;
    status: ProductStatus;
    publishedAt?: Date;
    version: number;
    auctionSettings?: IProductAuctionSettings;
    createdAt: Date;
    updatedAt: Date;
}

export interface IProductDocument extends IProduct, Document { }
export interface IProductMediaAssetDocument extends IProductMediaAsset, Document { }

const characteristicSchema = new mongoose.Schema<IProductCharacteristic>(
    {
        name: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true },
        group: { type: String, trim: true },
        unit: { type: String, trim: true },
        description: { type: String, trim: true },
        highlighted: { type: Boolean, default: false },
    },
    { _id: false }
);

const pricingSchema = new mongoose.Schema<IProductPricing>(
    {
        currency: { type: String, required: true, uppercase: true, trim: true, default: 'NGN' },
        amount: { type: Number, required: true, min: 0 },
        compareAtAmount: { type: Number, min: 0 },
        cost: { type: Number, required: true, min: 0 },
        taxInclusive: { type: Boolean, default: false },
    },
    { _id: false }
);

const inventorySchema = new mongoose.Schema<IProductInventory>(
    {
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        quantity: { type: Number, required: true, min: 0, default: 0 },
        lowStockThreshold: { type: Number, required: true, min: 0, default: 0 },
        allowBackorder: { type: Boolean, required: true, default: false },
    },
    { _id: false }
);

const dimensionsSchema = new mongoose.Schema<IProductDimensions>(
    {
        weightKg: { type: Number, min: 0 },
        lengthCm: { type: Number, min: 0 },
        widthCm: { type: Number, min: 0 },
        heightCm: { type: Number, min: 0 },
    },
    { _id: false }
);

const mediaSchema = new mongoose.Schema<IProductMedia>(
    {
        assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductMediaAsset' },
        kind: { type: String, enum: ['image', 'model_3d'], required: true },
        url: { type: String, required: true, trim: true },
        thumbnailUrl: { type: String, trim: true },
        publicId: { type: String, required: true, trim: true },
        mimeType: { type: String, required: true, trim: true },
        format: { type: String, required: true, trim: true },
        sizeBytes: { type: Number, required: true, min: 0 },
        originalName: { type: String, required: true, trim: true },
        altText: { type: String, trim: true },
        sortOrder: { type: Number, required: true, min: 0 },
        isPrimary: { type: Boolean, required: true, default: false },
        posterUrl: { type: String, trim: true },
        posterPublicId: { type: String, trim: true },
    },
    { _id: false }
);

const productMediaAssetSchema = new mongoose.Schema<IProductMediaAssetDocument>(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        kind: { type: String, enum: ['image', 'model_3d'], required: true },
        url: { type: String, required: true, trim: true },
        thumbnailUrl: { type: String, trim: true },
        publicId: { type: String, required: true, trim: true, unique: true },
        mimeType: { type: String, required: true, trim: true },
        format: { type: String, required: true, trim: true },
        sizeBytes: { type: Number, required: true, min: 0 },
        originalName: { type: String, required: true, trim: true },
        posterUrl: { type: String, trim: true },
        posterPublicId: { type: String, trim: true },
        status: {
            type: String,
            enum: ['ready', 'attached'],
            required: true,
            default: 'ready',
            index: true,
        },
        attachedProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
    },
    { timestamps: true }
);

const productSchema = new mongoose.Schema<IProductDocument>(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorStore', index: true },
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
        description: { type: String, required: true, trim: true },
        shortDescription: { type: String, trim: true },
        brand: { type: String, trim: true },
        category: { type: String, required: true, trim: true, index: true },
        subcategory: { type: String, trim: true },
        tags: { type: [String], default: [] },
        characteristics: { type: [characteristicSchema], default: [] },
        pricing: { type: pricingSchema, required: true },
        inventory: { type: inventorySchema, required: true },
        dimensions: dimensionsSchema,
        media: { type: [mediaSchema], default: [] },
        activePromoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Promo', index: true },
        status: {
            type: String,
            enum: ['draft', 'active', 'archived'],
            required: true,
            default: 'draft',
            index: true,
        },
        publishedAt: { type: Date },
        version: { type: Number, required: true, default: 0 },
        auctionSettings: {
            startingBid: { type: Number, min: 0 },
            minimumIncrement: { type: Number, min: 0 },
        },
    },
    { timestamps: true }
);

productSchema.index({ vendorId: 1, status: 1, updatedAt: -1 });
productSchema.index({ storeId: 1, status: 1, updatedAt: -1 });
productSchema.index({
    name: 'text',
    description: 'text',
    brand: 'text',
    category: 'text',
    subcategory: 'text',
    tags: 'text',
});
productMediaAssetSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

export const Product: Model<IProductDocument> =
    mongoose.models.Product ?? mongoose.model<IProductDocument>('Product', productSchema);

export const ProductMediaAsset: Model<IProductMediaAssetDocument> =
    mongoose.models.ProductMediaAsset ??
    mongoose.model<IProductMediaAssetDocument>('ProductMediaAsset', productMediaAssetSchema);
