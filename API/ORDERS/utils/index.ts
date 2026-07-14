import { AppError } from '../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../CORE/utils/constants/index.js';
import { Product } from '../../PRODUCTS/models/index.js';
import { Order } from '../models/index.js';
import { assertProductHasStock } from '../../PRODUCTS/utils/inventory.js';

const PLATFORM_FEE_PERCENT = 5;

export const createAuctionWinnerOrder = async ({
  buyerId,
  vendorId,
  productId,
  livestreamId,
  auctionId,
  winningBidAmount,
}: {
  buyerId: string;
  vendorId: string;
  productId: string;
  livestreamId: string;
  auctionId: string;
  winningBidAmount: number;
}) => {
  const product = await Product.findById(productId).select('name slug pricing version inventory').lean();
  if (!product) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
  }

  await assertProductHasStock(productId, 1);

  const currency = product.pricing?.currency ?? 'NGN';
  const platformFeeAmount = Number(((winningBidAmount * PLATFORM_FEE_PERCENT) / 100).toFixed(2));
  const vendorNetAmount = Number(Math.max(0, winningBidAmount - platformFeeAmount).toFixed(2));

  const order = await Order.create({
    buyerId,
    vendorId,
    productId,
    livestreamId,
    auctionId,
    source: 'livestream_auction',
    quantity: 1,
    paymentMethod: 'wallet',
    paymentTiming: 'immediate',
    status: 'pending_payment',
    paymentStatus: 'pending',
    breakdown: {
      originalUnitPrice: winningBidAmount,
      discountedUnitPrice: winningBidAmount,
      discountAmount: 0,
      subtotal: winningBidAmount,
      totalAmount: winningBidAmount,
      platformFeeAmount,
      companyDiscountShareAmount: 0,
      vendorNetAmount,
      currency,
    },
    pricingSnapshot: {
      productName: product.name,
      productSlug: product.slug,
      productVersion: product.version ?? 0,
      listPrice: product.pricing?.amount ?? winningBidAmount,
      winningBidAmount,
    },
  });

  return order;
};

export const createLivestreamBuyNowOrder = async ({
  buyerId,
  vendorId,
  productId,
  livestreamId,
  quantity,
}: {
  buyerId: string;
  vendorId: string;
  productId: string;
  livestreamId: string;
  quantity: number;
}) => {
  const product = await Product.findById(productId).select('name slug pricing version inventory').lean();
  if (!product) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
  }

  await assertProductHasStock(productId, quantity);
  const unitPrice = product.pricing?.amount ?? 0;
  if (unitPrice <= 0) {
    throw new AppError('Product does not have a valid list price.', 400);
  }

  const currency = product.pricing?.currency ?? 'NGN';
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  const platformFeeAmount = Number(((subtotal * PLATFORM_FEE_PERCENT) / 100).toFixed(2));
  const vendorNetAmount = Number(Math.max(0, subtotal - platformFeeAmount).toFixed(2));

  const order = await Order.create({
    buyerId,
    vendorId,
    productId,
    livestreamId,
    source: 'livestream_buy_now',
    quantity,
    paymentMethod: 'wallet',
    paymentTiming: 'immediate',
    status: 'pending_payment',
    paymentStatus: 'pending',
    breakdown: {
      originalUnitPrice: unitPrice,
      discountedUnitPrice: unitPrice,
      discountAmount: 0,
      subtotal,
      totalAmount: subtotal,
      platformFeeAmount,
      companyDiscountShareAmount: 0,
      vendorNetAmount,
      currency,
    },
    pricingSnapshot: {
      productName: product.name,
      productSlug: product.slug,
      productVersion: product.version ?? 0,
      listPrice: unitPrice,
    },
  });

  return order;
};
