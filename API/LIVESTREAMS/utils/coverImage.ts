export const resolveCoverImageUrl = (metadata: unknown): string | undefined => {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const coverImageUrl = (metadata as { coverImageUrl?: unknown }).coverImageUrl;
  return typeof coverImageUrl === 'string' && coverImageUrl.length > 0 ? coverImageUrl : undefined;
};
