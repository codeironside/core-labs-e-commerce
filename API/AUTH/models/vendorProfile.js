import mongoose from 'mongoose';
const bankDetailsSchema = new mongoose.Schema({
    bankCode: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    bankName: { type: String, required: true, default: '' },
}, { _id: false });
const addressDetailsSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
}, { _id: false });
const identitySchema = new mongoose.Schema({
    documentType: { type: String, required: true },
    nin: { type: String },
    documentUrl: { type: String },
    documentFileName: { type: String },
    ninVerified: { type: Boolean },
    verifiedFirstName: { type: String },
    verifiedLastName: { type: String },
}, { _id: false });
export const vendorProfileSchema = new mongoose.Schema({
    categories: { type: [String], default: [] },
    subcategories: { type: [String], default: [] },
    businessStatus: {
        type: String,
        enum: ['registered', 'unregistered'],
        required: true,
    },
    sellingExperience: { type: String, enum: ['starting', 'active'] },
    socialChannels: { type: [String], default: [] },
    address: { type: String, required: true },
    addressDetails: addressDetailsSchema,
    cacNumber: { type: String },
    payoutMethod: { type: String, enum: ['bank', 'usdc'] },
    bankDetails: bankDetailsSchema,
    cryptoWalletAddress: { type: String },
    identityVerification: identitySchema,
    identityVerificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'skipped', 'admin_bypass'],
        default: 'pending',
    },
    identitySkipped: { type: Boolean, default: false },
    canGoLive: { type: Boolean, default: false },
    adminBypassPhotoUrl: { type: String },
    vendorActivationPhotoUrl: { type: String },
    vendorActivationApprovedAt: { type: Date },
    vendorActivationApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agreedToGuidelines: { type: Boolean, default: false },
    tutorialCompleted: { type: Boolean, default: false },
}, { _id: false });
