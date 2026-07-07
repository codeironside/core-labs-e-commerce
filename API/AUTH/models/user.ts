import mongoose, { type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { vendorProfileSchema, type IVendorProfile } from './vendorProfile.js';
import { buyerProfileSchema, type IBuyerProfile } from './buyerProfile.js';
import type { OnboardingUserType } from '@core/constants/onboarding';

export type UserRole = 'super_admin' | 'admin' | 'editor' | 'member' | 'viewer';
export type OAuthProviderName = 'google' | 'github' | 'privy' | 'facebook';

export interface IUser {
  name: string;
  email: string;
  emailVerified: boolean;
  passwordHash?: string;
  phoneNumber?: string;
  image?: string;
  username?: string;
  role: UserRole;
  userType?: OnboardingUserType;
  workspaceId: mongoose.Types.ObjectId;
  profileImage?: string;
  avatarUrl?: string;
  cloudinaryPublicId?: string;
  bio?: string;
  onboardingComplete: boolean;
  vendorProfile?: IVendorProfile;
  buyerProfile?: IBuyerProfile;
  oauthProvider?: OAuthProviderName;
  oauthProviderId?: string;
  biometricPublicKey?: string;
  fcmToken?: string;
  privyUserId?: string;
  solanaUsdcWalletAddress?: string;
  platformBanned?: boolean;
  platformBanReason?: string;
  platformBannedAt?: Date;
  platformBannedBy?: mongoose.Types.ObjectId;
  livestreamBanned?: boolean;
  livestreamBanReason?: string;
  livestreamBannedAt?: Date;
  livestreamBannedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
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
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = async function comparePassword(candidate: string): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidate, this.passwordHash);
};

export const UserModel: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema, 'user');
export const LegacyUserModel: Model<IUserDocument> = mongoose.model<IUserDocument>(
  'LegacyUser',
  userSchema,
  'users',
);
