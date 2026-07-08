import mongoose, { type Document, type Model } from 'mongoose';
import type { IProductCharacteristic, IProductMedia, IProductPricing } from './index.js';

export interface IProductVersionSnapshot {
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  pricing: IProductPricing;
  characteristics: IProductCharacteristic[];
  media: IProductMedia[];
}

export interface IProductVersion {
  productId: mongoose.Types.ObjectId;
  versionNumber: number;
  snapshot: IProductVersionSnapshot;
  changedFields: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductVersionDocument extends IProductVersion, Document {}

const productVersionSchema = new mongoose.Schema<IProductVersionDocument>(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    versionNumber: { type: Number, required: true, min: 0 },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    changedFields: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

productVersionSchema.index({ productId: 1, versionNumber: -1 }, { unique: true });

export const ProductVersion: Model<IProductVersionDocument> =
  mongoose.models.ProductVersion ??
  mongoose.model<IProductVersionDocument>('ProductVersion', productVersionSchema, 'productversions');
