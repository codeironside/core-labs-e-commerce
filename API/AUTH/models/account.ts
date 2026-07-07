import mongoose, { type Document, type Model } from 'mongoose';

export type AuthProviderId = 'credential' | 'google' | 'github' | 'privy' | 'facebook';

export interface IAccount {
  userId: mongoose.Types.ObjectId;
  accountId: string;
  providerId: AuthProviderId;
  scope?: string;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountDocument extends IAccount, Document {}

const accountSchema = new mongoose.Schema<IAccountDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: String, required: true },
    providerId: { type: String, required: true },
    scope: { type: String },
    password: { type: String, select: false },
  },
  { timestamps: true },
);

accountSchema.index({ providerId: 1, accountId: 1 }, { unique: true });

export const AccountModel: Model<IAccountDocument> = mongoose.model<IAccountDocument>(
  'Account',
  accountSchema,
  'account',
);
