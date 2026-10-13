import type { FoodBrandEntry } from './brand-catalog';
import { normalizeSearchEvidence, safeExternalUrl, type SearchEvidence, type SearchReference } from '@/shared/domain/search-evidence';

function matchesOfficialDomain(url: string, domains: string[]) {
  const host = new URL(url).hostname.toLowerCase();
  return domains.some(domain => {
    const official = domain.toLowerCase().replace(/^www\./, '');
    return host === official || host.endsWith('.' + official);
  });
}

/** Only called after a real search AND successful food extraction. No model-generated URLs. */
export function buildSearchEvidence(
  id: string, brands: FoodBrandEntry[], references: SearchReference[], foodNames: string[], fallbackBrands: string[] = []
): SearchEvidence | undefined {
  const sources = references.flatMap(reference => {
    const url = safeExternalUrl(reference.url);
    if (!url) return [];
    const officialBrands = brands.filter(brand => {
      const domains = [...brand.officialDomains, ...brand.sources.flatMap(source => {
        const sourceUrl = source.kind !== 'exchange_disclosure' ? safeExternalUrl(source.url) : undefined;
        return sourceUrl ? [new URL(sourceUrl).hostname] : [];
      })];
      return matchesOfficialDomain(url, domains);
    }).map(brand => brand.brand);
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
