import mongoose from 'mongoose';
export const buyerProfileSchema = new mongoose.Schema({
    categories: { type: [String], default: [] },
    subcategories: { type: [String], default: [] },
}, { _id: false });
