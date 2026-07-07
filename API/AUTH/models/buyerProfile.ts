import mongoose from 'mongoose';

export interface IBuyerProfile {
  categories: string[];
  subcategories: string[];
}

export const buyerProfileSchema = new mongoose.Schema<IBuyerProfile>(
  {
    categories: { type: [String], default: [] },
    subcategories: { type: [String], default: [] },
  },
  { _id: false },
);
