import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { vendorProfileSchema } from './vendorProfile.js';
import { buyerProfileSchema } from './buyerProfile.js';
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, required: true, default: false },
    passwordHash: { type: String, select: false },
    phoneNumber: { type: String, sparse: true, unique: true },
    image: { type: String },
    username: { type: String, sparse: true, unique: true, trim: true },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'editor', 'member', 'viewer'],
        default: 'member',
    },
    userType: { type: String, enum: ['vendor', 'buyer', 'editor'] },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    profileImage: { type: String },
    avatarUrl: { type: String },
    cloudinaryPublicId: { type: String },
    bio: { type: String, maxlength: 500 },
    onboardingComplete: { type: Boolean, required: true, default: false },
    vendorProfile: vendorProfileSchema,
    buyerProfile: buyerProfileSchema,
    oauthProvider: { type: String, enum: ['google', 'github', 'privy', 'facebook'] },
    oauthProviderId: { type: String },
    biometricPublicKey: { type: String },
    fcmToken: { type: String, select: false },
    privyUserId: { type: String, sparse: true, unique: true },
    solanaUsdcWalletAddress: { type: String, trim: true },
    platformBanned: { type: Boolean, default: false },
    platformBanReason: { type: String, maxlength: 500 },
    platformBannedAt: { type: Date },
    platformBannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    livestreamBanned: { type: Boolean, default: false },
    livestreamBanReason: { type: String, maxlength: 500 },
    livestreamBannedAt: { type: Date },
    livestreamBannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
userSchema.methods.comparePassword = async function comparePassword(candidate) {
    if (!this.passwordHash) {
        return false;
    }
    return bcrypt.compare(candidate, this.passwordHash);
};
export const UserModel = mongoose.model('User', userSchema, 'user');
export const LegacyUserModel = mongoose.model('LegacyUser', userSchema, 'users');
