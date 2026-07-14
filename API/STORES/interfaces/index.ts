export type PublicStorefrontProduct = {
  _id: string;
  name: string;
  category?: string | undefined;
  pricing?: {
    amount?: number | undefined;
    currency?: string | undefined;
    compareAtAmount?: number | undefined;
    originalPrice?: number | undefined;
    discountedPrice?: number | undefined;
    hasActivePromo?: boolean | undefined;
    activePromo?: unknown;
    activePromos?: unknown;
    cost?: number | undefined;
    taxInclusive?: boolean | undefined;
  } | undefined;
  media?: Array<{ url?: string | undefined; thumbnailUrl?: string | undefined }> | undefined;
  shortDescription?: string | undefined;
  inventory?: { quantity?: number | undefined } | undefined;
  soldCount?: number | undefined;
};

export type PublicStorefront = {
  id: string;
  name: string;
  slug: string;
  description?: string | undefined;
  logoUrl?: string | null | undefined;
  coverImageUrl?: string | null | undefined;
  address?: {
    formattedAddress?: string | undefined;
    line1?: string | undefined;
    line2?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    country?: string | undefined;
    postalCode?: string | undefined;
  } | null | undefined;
  location?: { lat: number; lng: number } | null | undefined;
  vendorId: string;
  vendorName: string;
  productCount: number;
  products: PublicStorefrontProduct[];
};
