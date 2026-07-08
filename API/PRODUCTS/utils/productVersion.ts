import type { Types } from 'mongoose';
import { ProductVersion, type IProductVersionSnapshot } from '../models/productVersion.js';

type ProductSnapshotSource = {
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  pricing: IProductVersionSnapshot['pricing'];
  characteristics: IProductVersionSnapshot['characteristics'];
  media: IProductVersionSnapshot['media'];
};

const TRACKED_FIELDS = ['name', 'description', 'shortDescription', 'category', 'subcategory', 'pricing', 'characteristics', 'media'] as const;

export const buildProductSnapshot = (product: ProductSnapshotSource): IProductVersionSnapshot => ({
  name: product.name,
  description: product.description,
  shortDescription: product.shortDescription,
  category: product.category,
  subcategory: product.subcategory,
  pricing: { ...product.pricing },
  characteristics: product.characteristics.map((item) => ({ ...item })),
  media: product.media.map((item) => ({ ...item })),
});

export const detectChangedFields = (
  before: ProductSnapshotSource,
  after: ProductSnapshotSource,
): string[] => {
  const changed: string[] = [];
  for (const field of TRACKED_FIELDS) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changed.push(field);
    }
  }
  return changed;
};

export const recordProductVersion = async ({
  productId,
  versionNumber,
  snapshot,
  changedFields,
  createdBy,
}: {
  productId: Types.ObjectId | string;
  versionNumber: number;
  snapshot: IProductVersionSnapshot;
  changedFields: string[];
  createdBy: Types.ObjectId | string;
}): Promise<void> => {
  await ProductVersion.findOneAndUpdate(
    { productId, versionNumber },
    {
      $setOnInsert: {
        productId,
        versionNumber,
        snapshot,
        changedFields,
        createdBy,
      },
    },
    { upsert: true, new: true },
  );
};
