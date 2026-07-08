export type PublicStorefrontProduct = {
  _id: string;
  name: string;
  category?: string;
  pricing?: {
    amount?: number;
    currency?: string;
    compareAtAmount?: number;
  };
  media?: Array<{ url?: string; thumbnailUrl?: string }>;
  shortDescription?: string;
  inventory?: { quantity?: number };
  soldCount?: number;
};

export type PublicStorefront = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  address?: {
    formattedAddress?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } | null;
  location?: { lat: number; lng: number } | null;
  vendorId: string;
  vendorName: string;
  productCount: number;
  products: PublicStorefrontProduct[];
};
