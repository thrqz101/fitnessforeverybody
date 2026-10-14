import { type FoodBrandEntry, normalizeBrandText } from './brand-catalog';
import { normalizeSearchEvidence, safeExternalUrl, type SearchEvidence, type SearchReference } from '@/shared/domain/search-evidence';

function matchesOfficialDomain(url: string, domains: string[]) {
  const host = new URL(url).hostname.toLowerCase();
  return domains.some(domain => {
    const official = domain.toLowerCase().replace(/^www\./, '');
    return host === official || host.endsWith('.' + official);
  });
}

function officialDomains(brand: FoodBrandEntry) {
  return [...brand.officialDomains, ...brand.sources.flatMap(source => {
    const sourceUrl = source.kind !== 'exchange_disclosure' ? safeExternalUrl(source.url) : undefined;
    return sourceUrl ? [new URL(sourceUrl).hostname] : [];
  })];
}

/**
 * A brand search only counts as having found the product when the extraction used matching public numbers
 * (`brand-product`) and a source can be tied to the brand: an official domain, or the brand name in the source
 * title. A store outside the catalogue has no brand record to check, so any usable source is accepted.
 */
export function searchFoundBrandProduct(
  foods: { recognitionMode?: string }[], brands: FoodBrandEntry[], references: SearchReference[]
): boolean {
  if (!foods.some(food => food.recognitionMode === 'brand-product')) return false;
  const sources = references.flatMap(reference => {
    const url = safeExternalUrl(reference.url);
    return url ? [{ url, title: normalizeBrandText(reference.title) }] : [];
  });
  if (!brands.length) return sources.length > 0;
  return sources.some(source => brands.some(brand =>
    matchesOfficialDomain(source.url, officialDomains(brand))
    || [brand.brand, ...brand.aliases, brand.nameEn ?? ''].map(normalizeBrandText).some(name => name.length >= 2 && source.title.includes(name))));
}

/** Only called after a real search AND successful food extraction. No model-generated URLs. */
export function buildSearchEvidence(
  id: string, brands: FoodBrandEntry[], references: SearchReference[], foodNames: string[], fallbackBrands: string[] = []
): SearchEvidence | undefined {
  const sources = references.flatMap(reference => {
    const url = safeExternalUrl(reference.url);
    if (!url) return [];
    const officialBrands = brands.filter(brand => matchesOfficialDomain(url, officialDomains(brand))).map(brand => brand.brand);
    return [{ title: reference.title, url, ...(officialBrands.length ? { officialBrands } : {}) }];
  });
  const evidenceBrands = brands.map(brand => {
    const website = safeExternalUrl(brand.officialWebsite);
    const officialPage = brand.sources.find(source => source.kind === 'official_brand' && safeExternalUrl(source.url))
      ?? brand.sources.find(source => source.kind === 'official_group' && safeExternalUrl(source.url));
    const url = website || safeExternalUrl(officialPage?.url);
    return { name: brand.brand, ...(brand.nameEn ? { nameEn: brand.nameEn } : {}), ...(url ? { url, linkKind: website ? 'website' as const : 'official_page' as const } : {}) };
  });
  if (!evidenceBrands.length) {
    for (const name of Array.from(new Set(fallbackBrands)).slice(0, 6)) if (name.trim()) evidenceBrands.push({ name });
  }
  return normalizeSearchEvidence({ id, status: 'succeeded', brands: evidenceBrands, sources, foodNames });
}
