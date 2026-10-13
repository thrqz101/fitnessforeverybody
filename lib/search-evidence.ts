export type SearchReference = { title: string; url: string; officialBrands?: string[] };
export type SearchBrand = { name: string; nameEn?: string; url?: string; linkKind?: 'website' | 'official_page' };
export type SearchEvidence = {
  id: string;
  status: 'succeeded';
  brands: SearchBrand[];
  sources: SearchReference[];
  foodNames: string[];
};

export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}

/** Shared by the API, persisted food normalization, and link rendering. */
export function normalizeSearchEvidence(value: unknown): SearchEvidence | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<SearchEvidence>;
  if (raw.status !== 'succeeded' || typeof raw.id !== 'string' || !raw.id || !Array.isArray(raw.sources)) return undefined;
  const seen = new Set<string>();
  const sources = raw.sources.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const url = safeExternalUrl(item.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const officialBrands = Array.isArray(item.officialBrands) ? item.officialBrands.filter(n => typeof n === 'string').slice(0, 6) : [];
    return [{ url, title: typeof item.title === 'string' ? item.title.slice(0, 200) : new URL(url).hostname, ...(officialBrands.length ? { officialBrands } : {}) }];
  }).slice(0, 3);
  if (!sources.length) return undefined;
  const brands = Array.isArray(raw.brands) ? raw.brands.flatMap(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) return [];
    const url = safeExternalUrl(item.url);
    return [{ name: item.name.slice(0, 100), ...(typeof item.nameEn === 'string' ? { nameEn: item.nameEn.slice(0, 100) } : {}), ...(url ? { url, linkKind: item.linkKind === 'website' ? 'website' as const : 'official_page' as const } : {}) }];
  }).slice(0, 6) : [];
  return { id: raw.id.slice(0, 100), status: 'succeeded', brands, sources,
    foodNames: Array.isArray(raw.foodNames) ? raw.foodNames.filter(n => typeof n === 'string').map(n => n.slice(0, 100)).slice(0, 6) : [] };
}
