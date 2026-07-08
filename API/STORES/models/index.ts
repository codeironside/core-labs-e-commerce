import mongoose, { type Document, type Model } from 'mongoose';

export type VendorStoreStatus = 'active' | 'archived';
export type StoreManagerRole = 'manager' | 'streamer';

export type StoreAddress = {
  formattedAddress?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};

export type StoreLocation = {
  lat: number;
  lng: number;
};

export interface IVendorStore {
  vendorId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  address?: StoreAddress;
  location?: StoreLocation;
  googlePlaceId?: string;
  status: VendorStoreStatus;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStoreManager {
  storeId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: StoreManagerRole;
  invitedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStoreChat {
  storeId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  buyerUserId: mongoose.Types.ObjectId;
  lastMessage: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStoreChatMessage {
  conversationId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  senderUserId: mongoose.Types.ObjectId;
  text: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorStoreDocument extends IVendorStore, Document {}
export interface IStoreManagerDocument extends IStoreManager, Document {}
export interface IStoreChatDocument extends IStoreChat, Document {}
export interface IStoreChatMessageDocument extends IStoreChatMessage, Document {}

const vendorStoreSchema = new mongoose.Schema<IVendorStoreDocument>(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    coverImageUrl: { type: String, trim: true },
    address: {
      formattedAddress: { type: String, trim: true },
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    googlePlaceId: { type: String, trim: true },
    status: { type: String, enum: ['active', 'archived'], required: true, default: 'active', index: true },
    isDefault: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

vendorStoreSchema.index({ vendorId: 1, status: 1, updatedAt: -1 });

const storeManagerSchema = new mongoose.Schema<IStoreManagerDocument>(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorStore', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['manager', 'streamer'], required: true, default: 'streamer' },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

storeManagerSchema.index({ storeId: 1, userId: 1 }, { unique: true });

const storeChatSchema = new mongoose.Schema<IStoreChatDocument>(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorStore', required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastMessage: { type: String, required: true, trim: true, default: 'Start a conversation' },
    lastMessageAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

storeChatSchema.index({ storeId: 1, buyerUserId: 1 }, { unique: true });
storeChatSchema.index({ vendorId: 1, updatedAt: -1 });
storeChatSchema.index({ buyerUserId: 1, updatedAt: -1 });

const storeChatMessageSchema = new mongoose.Schema<IStoreChatMessageDocument>(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreChat', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorStore', required: true, index: true },
    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

storeChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const VendorStore: Model<IVendorStoreDocument> =
  mongoose.models.VendorStore ?? mongoose.model<IVendorStoreDocument>('VendorStore', vendorStoreSchema);

export const StoreManager: Model<IStoreManagerDocument> =
  mongoose.models.StoreManager ?? mongoose.model<IStoreManagerDocument>('StoreManager', storeManagerSchema);

export const StoreChat: Model<IStoreChatDocument> =
  mongoose.models.StoreChat ?? mongoose.model<IStoreChatDocument>('StoreChat', storeChatSchema);

export const StoreChatMessage: Model<IStoreChatMessageDocument> =
  mongoose.models.StoreChatMessage ??
  mongoose.model<IStoreChatMessageDocument>('StoreChatMessage', storeChatMessageSchema);
