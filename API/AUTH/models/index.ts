import mongoose, { type Document, type Model } from 'mongoose';

export type UserRole = 'super_admin' | 'admin' | 'editor' | 'member' | 'viewer';
export type UserType = 'vendor' | 'buyer' | 'editor';

export interface IUser {
  name: string;
  email: string;
  role: UserRole;
  userType?: UserType;
  workspaceId: mongoose.Types.ObjectId;
  platformBanned?: boolean;
  livestreamBanned?: boolean;
  profileImage?: string;
  vendorProfile?: {
    canGoLive?: boolean;
    identityVerificationStatus?: string;
  };
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    role: { type: String, default: 'member' },
    userType: { type: String, enum: ['vendor', 'buyer', 'editor'] },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    vendorProfile: {
      canGoLive: { type: Boolean },
      identityVerificationStatus: { type: String },
    },
  },
  { timestamps: true, strict: false },
);

export const User: Model<IUserDocument> =
  mongoose.models.User ?? mongoose.model<IUserDocument>('User', userSchema, 'user');
