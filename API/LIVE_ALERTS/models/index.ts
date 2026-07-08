import mongoose, { type Document, type Model } from 'mongoose';

export type LiveAlertTargetType = 'store' | 'vendor' | 'product';

export type LiveAlertChannels = {
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
};

export interface ILiveAlertSubscription {
  userId: mongoose.Types.ObjectId;
  targetType: LiveAlertTargetType;
  targetId: mongoose.Types.ObjectId;
  channels: LiveAlertChannels;
  contactPhone?: string;
}

export interface ILiveAlertSubscriptionDocument extends ILiveAlertSubscription, Document {}

const liveAlertChannelsSchema = new mongoose.Schema<LiveAlertChannels>(
  {
    inApp: { type: Boolean, required: true, default: true },
    email: { type: Boolean, required: true, default: false },
    whatsapp: { type: Boolean, required: true, default: false },
    sms: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const liveAlertSubscriptionSchema = new mongoose.Schema<ILiveAlertSubscriptionDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['store', 'vendor', 'product'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    channels: { type: liveAlertChannelsSchema, required: true },
    contactPhone: { type: String, trim: true },
  },
  { timestamps: true },
);

liveAlertSubscriptionSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
liveAlertSubscriptionSchema.index({ targetType: 1, targetId: 1 });

export const LiveAlertSubscription: Model<ILiveAlertSubscriptionDocument> =
  mongoose.models.LiveAlertSubscription
  ?? mongoose.model<ILiveAlertSubscriptionDocument>(
    'LiveAlertSubscription',
    liveAlertSubscriptionSchema,
    'livealertsubscriptions',
  );
