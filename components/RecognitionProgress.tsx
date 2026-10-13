'use client';
import { Check, ChevronDown, CircleAlert, Loader2, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { RecognitionStep } from '@/lib/recognition-events';
import type { FoodLogItem } from '@/lib/types';
import { normalizeSearchEvidence } from '@/lib/search-evidence';
import { RecognitionSources } from './RecognitionSources';

export function RecognitionProgress({ steps, running, foods = [] }: { steps: RecognitionStep[]; running: boolean; foods?: FoodLogItem[] }) {
  const { language } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  const failed = steps.some(step => step.status === 'error');
  const hasSources = foods.some(food => normalizeSearchEvidence(food.searchEvidence));
  useEffect(() => { setExpanded(running); }, [running]);
  useEffect(() => {
    const element = viewport.current;
    if (element && expanded) element.scrollTo({ top: element.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [steps, expanded]);
  if (!steps.length && !hasSources) return null;
  const title = running ? (language === 'en' ? 'Working on your meal' : '正在分析这一餐')
    : failed ? (language === 'en' ? 'Recognition needs another try' : '识别暂未完成') : (language === 'en' ? 'View recognition process and sources' : '查看识别过程与来源');
  return <details className="recognition-progress" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} data-testid="recognition-progress">
    <summary><span className="recognition-progress__title">{running ? <Loader2 size={15} className="recognition-step__spinner" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}{title}</span><ChevronDown size={15} aria-hidden="true" /></summary>
    {steps.length > 0 && <div ref={viewport} className="recognition-progress__viewport" role="log" aria-live="polite" aria-label={language === 'en' ? 'Recognition progress' : '识别进度'}>
      <ol>{steps.map(step => <li key={step.id} data-step={step.id} data-status={step.status}>
        <span className="recognition-step__icon" aria-hidden="true">{step.status === 'active' && running ? <Loader2 size={14} className="recognition-step__spinner" /> : step.status === 'complete' ? <Check size={14} /> : step.status === 'error' ? <X size={14} /> : <CircleAlert size={14} />}</span>
        <span>{language === 'en' ? step.labelEn : step.labelZh}</span>
      </li>)}</ol>
    </div>}
    {!running && <RecognitionSources foods={foods} />}
  </details>;
}
