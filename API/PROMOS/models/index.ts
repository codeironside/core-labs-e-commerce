import mongoose, { type Document, type Model } from 'mongoose';

export type PromoScope = 'product' | 'category' | 'platform' | 'logistics';
export type PromoCreatorRole = 'vendor' | 'admin';
export type PromoType = 'percentage' | 'fixed';
export type PromoStatus = 'active' | 'inactive' | 'expired';
export type PromoApprovalStatus = 'pending' | 'approved' | 'rejected';
export type VendorApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface IPromoVendorApplication {
    vendorId: mongoose.Types.ObjectId;
    applicationStatus: VendorApplicationStatus;
    appliedAt: Date;
    reviewedAt?: Date;
    reviewNote?: string;
}

export interface IPromoEligibilityCriteria {
    minWatchHours?: number;
    minSalesCount?: number;
}

export interface IPromo {
    createdBy: mongoose.Types.ObjectId;
    creatorRole: PromoCreatorRole;
    scope: PromoScope;
    title: string;
    description?: string;
    code?: string;
    type: PromoType;
    value: number;
    currency?: string;
    productIds: mongoose.Types.ObjectId[];
    categories: string[];
    applyPlatformWide: boolean;
    isLogisticsPromo: boolean;
    logisticsRegions: string[];
    maxShippingDiscountAmount?: number;
    maxDiscountPerItem?: number;
    maxCategoriesApplied?: number;
    maxTotalRedemptions?: number;
    maxRedemptionsPerUser?: number;
    currentRedemptions: number;
    vendorApplications: IPromoVendorApplication[];
    eligibilityCriteria?: IPromoEligibilityCriteria;
    startsAt: Date;
    endsAt?: Date;
    status: PromoStatus;
    approvalStatus: PromoApprovalStatus;
    approvedBy?: mongoose.Types.ObjectId;
    approvalNote?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IPromoDocument extends IPromo, Document {}

const promoSchema = new mongoose.Schema<IPromoDocument>(
    {
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        creatorRole: { type: String, enum: ['vendor', 'admin'], required: true },
        scope: {
            type: String,
            enum: ['product', 'category', 'platform', 'logistics'],
            required: true,
            index: true,
        },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        code: { type: String, trim: true, uppercase: true, sparse: true },
        type: { type: String, enum: ['percentage', 'fixed'], required: true },
        value: { type: Number, required: true, min: 0 },
        currency: {
            type: String,
            trim: true,
            uppercase: true,
            enum: ['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'KES', 'ZAR', 'CAD', 'AED', 'XOF', 'SOL', 'USDC'],
        },
        productIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Product', default: [] },
        categories: { type: [String], default: [] },
        applyPlatformWide: { type: Boolean, default: false },
        isLogisticsPromo: { type: Boolean, default: false, index: true },
        logisticsRegions: { type: [String], default: [] },
        maxShippingDiscountAmount: { type: Number, min: 0 },
        maxDiscountPerItem: { type: Number, min: 0 },
        maxCategoriesApplied: { type: Number, min: 1 },
        maxTotalRedemptions: { type: Number, min: 1 },
        maxRedemptionsPerUser: { type: Number, min: 1 },
        currentRedemptions: { type: Number, required: true, default: 0, min: 0 },
        vendorApplications: {
            type: [
                new mongoose.Schema<IPromoVendorApplication>(
                    {
                        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
                        applicationStatus: {
                            type: String,
                            enum: ['pending', 'approved', 'rejected'],
                            required: true,
                            default: 'pending',
                        },
                        appliedAt: { type: Date, required: true },
                        reviewedAt: { type: Date },
                        reviewNote: { type: String, trim: true },
                    },
                    { _id: false },
                ),
            ],
            default: [],
        },
        eligibilityCriteria: {
            minWatchHours: { type: Number, min: 0 },
            minSalesCount: { type: Number, min: 0 },
        },
        startsAt: { type: Date, required: true },
        endsAt: { type: Date },
        status: {
            type: String,
            enum: ['active', 'inactive', 'expired'],
            required: true,
            default: 'active',
            index: true,
        },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            required: true,
            default: 'approved',
            index: true,
        },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvalNote: { type: String, trim: true },
    },
    { timestamps: true },
);

promoSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
promoSchema.index({ scope: 1, status: 1, approvalStatus: 1, startsAt: 1 });
promoSchema.index({ productIds: 1, status: 1 });
promoSchema.index({ categories: 1, status: 1 });
promoSchema.index({ code: 1 }, { sparse: true });

export const Promo: Model<IPromoDocument> =
    mongoose.models.Promo ?? mongoose.model<IPromoDocument>('Promo', promoSchema);
