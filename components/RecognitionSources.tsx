'use client';
import { ArrowUpRight, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { normalizeSearchEvidence } from '@/lib/search-evidence';
import type { FoodLogItem } from '@/lib/types';

export function RecognitionSources({ foods }: { foods: FoodLogItem[] }) {
  const { language } = useI18n();
  const seen = new Set<string>();
  const groups = foods.flatMap(food => {
    const evidence = normalizeSearchEvidence(food.searchEvidence);
    if (!evidence || seen.has(evidence.id)) return [];
    seen.add(evidence.id); return [evidence];
  });
  if (!groups.length) return null;
  return <section className="recognition-sources" aria-label={language === 'en' ? 'Web search references' : '联网搜索参考资料'} data-testid="recognition-sources">
    <h3><Globe size={16} aria-hidden="true" />{language === 'en' ? 'Web search references' : '联网搜索参考资料'}</h3>
    {groups.map((evidence, index) => <details key={evidence.id} open={index === 0} className="recognition-sources__group">
      <summary>{evidence.foodNames.join(language === 'en' ? ', ' : '、') || (language === 'en' ? 'Recognized foods' : '识别食物')}</summary>
      <div className="recognition-sources__brands">{evidence.brands.map(brand => <span key={brand.name}>
        <strong>{language === 'en' ? brand.nameEn || brand.name : brand.name}</strong>{brand.url ? <a href={brand.url} target="_blank" rel="noopener noreferrer" aria-label={`${language === 'en' ? brand.nameEn || brand.name : brand.name} · ${brand.linkKind === 'website' ? (language === 'en' ? 'Brand website' : '品牌官网') : (language === 'en' ? 'Official page' : '官方页面')}`}>{brand.linkKind === 'website' ? (language === 'en' ? 'Brand website' : '品牌官网') : (language === 'en' ? 'Official page' : '官方页面')}<ArrowUpRight size={13} aria-hidden="true" /></a> : null}
      </span>)}</div>
      <ul>{evidence.sources.map(source => <li key={source.url}>
        <a href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.title || new URL(source.url).hostname}</span><ArrowUpRight size={13} aria-hidden="true" /></a>
        <small>{new URL(source.url).hostname}{source.officialBrands?.length ? (language === 'en' ? ' · Official source' : ' · 官方来源') : (language === 'en' ? ' · Public reference' : ' · 公开参考')}</small>
      </li>)}</ul>
    </details>)}
    <p>{language === 'en' ? 'These references were retrieved during recognition. Nutrition values may still include estimates.' : '以上为识别时实际检索到的参考资料，营养数值仍可能包含估算。'}</p>
  </section>;
}
