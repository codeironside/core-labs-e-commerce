export const buildStoreSlug = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'store';

export const buildUniqueStoreSlug = async (
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> => {
  const base = buildStoreSlug(name);
  const firstAvailable = await exists(base);
  if (!firstAvailable) return base;

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    const taken = await exists(candidate);
    if (!taken) return candidate;
  }

  return `${base}-${Date.now()}`;
};
