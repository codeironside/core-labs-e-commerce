import mongoose from 'mongoose';
const accountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: String, required: true },
    providerId: { type: String, required: true },
    scope: { type: String },
    password: { type: String, select: false },
}, { timestamps: true });
accountSchema.index({ providerId: 1, accountId: 1 }, { unique: true });
export const AccountModel = mongoose.model('Account', accountSchema, 'account');
