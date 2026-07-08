import mongoose from 'mongoose';
import { AppError } from '../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../CORE/utils/constants/index.js';
import { Product } from '../models/index.js';

export const PRODUCT_MIN_INVENTORY = 2;
export const PRODUCT_DEFAULT_INVENTORY = 5;

export const assertProductHasStock = async (
  productId: string,
  quantity: number,
): Promise<void> => {
  const product = await Product.findById(productId)
    .select('inventory.quantity name')
    .lean();

  if (!product) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_NOT_FOUND, 404);
  }

  const available = product.inventory?.quantity ?? 0;
  if (available < quantity) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_OUT_OF_STOCK, 409);
  }
};

export const decrementInventoryForPaidOrder = async (
  productId: string,
  quantity: number,
): Promise<void> => {
  const updated = await Product.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(productId),
      'inventory.quantity': { $gte: quantity },
    },
    {
      $inc: {
        'inventory.quantity': -quantity,
        version: 1,
      },
    },
    { new: true },
  )
    .select('_id inventory.quantity')
    .lean();

  if (!updated) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.PRODUCT_OUT_OF_STOCK, 409);
  }
};

export const releaseInventoryAfterFailedPayment = async (
  productId: string,
  quantity: number,
): Promise<void> => {
  await Product.findByIdAndUpdate(productId, {
    $inc: {
      'inventory.quantity': quantity,
      version: 1,
    },
  });
};
