import mongoose, { type Document, type Model } from 'mongoose';

export type OrderSource = 'direct_purchase' | 'livestream_auction' | 'livestream_buy_now';
export type OrderStatus = 'pending_payment' | 'paid' | 'payment_failed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type PaymentMethod = 'wallet' | 'saved_card';
export type PaymentTiming = 'immediate' | 'pay_later';
export type PayLaterStatus = 'active' | 'expired' | 'fulfilled';

export interface IOrderPaymentBreakdown {
  originalUnitPrice: number;
  discountedUnitPrice: number;
  discountAmount: number;
  subtotal: number;
  platformFeeAmount: number;
  companyDiscountShareAmount: number;
  vendorNetAmount: number;
  totalAmount: number;
  currency: string;
}

export interface IOrder {
  buyerId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  source: OrderSource;
  livestreamId?: mongoose.Types.ObjectId;
  auctionId?: mongoose.Types.ObjectId;
  quantity: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentTiming: PaymentTiming;
  payLaterExpiresAt?: Date;
  payLaterStatus?: PayLaterStatus;
  vendorWinnerMessage?: string;
  paymentReference?: string;
  breakdown: IOrderPaymentBreakdown;
  pricingSnapshot: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderDocument extends IOrder, Document {}

const orderSchema = new mongoose.Schema<IOrderDocument>(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    source: { type: String, enum: ['direct_purchase', 'livestream_auction', 'livestream_buy_now'], required: true },
    livestreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamSession' },
    auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamAuction' },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'payment_failed', 'cancelled'],
      required: true,
      default: 'pending_payment',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      required: true,
      default: 'pending',
    },
    paymentMethod: { type: String, enum: ['wallet', 'saved_card'], required: true },
    paymentTiming: { type: String, enum: ['immediate', 'pay_later'], default: 'immediate' },
    payLaterExpiresAt: { type: Date },
    payLaterStatus: { type: String, enum: ['active', 'expired', 'fulfilled'] },
    vendorWinnerMessage: { type: String, maxlength: 2000, trim: true },
    paymentReference: { type: String },
    breakdown: {
      originalUnitPrice: { type: Number, required: true },
      discountedUnitPrice: { type: Number, required: true },
      discountAmount: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      platformFeeAmount: { type: Number, required: true },
      companyDiscountShareAmount: { type: Number, required: true },
      vendorNetAmount: { type: Number, required: true },
      totalAmount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    pricingSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ auctionId: 1 }, { unique: true, sparse: true });

export const Order: Model<IOrderDocument> =
  mongoose.models.Order ?? mongoose.model<IOrderDocument>('Order', orderSchema);
