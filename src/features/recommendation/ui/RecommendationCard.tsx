"use client";

import type { Recommendation, MacroTotals } from "@/shared/domain/types";
import { useI18n } from "@/shared/i18n/i18n";
import { addMacros } from "@/shared/domain/nutrition";
import { macroLabels } from "@/shared/domain/labels";
import { Utensils, Check } from "lucide-react";
import { getCompletionSnapshot } from "@/features/recommendation/domain/ranking";
import { inferSuggestedMeal } from "@/features/recommendation/domain/filters";

export function localizeRecommendationTitle(title: string, translate: (text: string) => string) {
  const composed = title.match(/^(.+?)（(.+)）$/);
  if (!composed) return translate(title);
  return `${translate(composed[1])} (${translate(composed[2])})`;
}

function localizeRecommendationNote(note: string, translate: (text: string) => string) {
  const composed = note.match(/^(.+?)（(知识库估算，可按实际份量微调。)）$/);
  if (!composed) return translate(note);
  return `${translate(composed[1])} (${translate(composed[2])})`;
}

export function RecommendationCard({
  recommendation,
  targets,
  totals,
  selected,
  onPick,
  onChoose
}: {
  recommendation: Recommendation;
  targets: MacroTotals;
  totals: MacroTotals;
  selected: boolean;
  onPick: () => void;
  onChoose: () => void;
}) {
  const { t } = useI18n();
  const afterCompletion = getCompletionSnapshot(addMacros(totals, recommendation.macros), targets);
  const suggestedMeal = inferSuggestedMeal(recommendation);

  return (
    <article className={`recommendation-card border p-4 transition ${selected ? "border-coral bg-coral/10 shadow-soft" : "border-ink/10 bg-paper/75"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase tracking-[0.16em] text-moss">
            <span>{t(categoryLabels[recommendation.category])}</span>
            {suggestedMeal ? <span>{t(suggestedMeal)}</span> : null}
          </p>
          <h3 className="mt-1 truncate text-xl font-black leading-tight text-ink">{t(recommendation.brand)}</h3>
          <p className="mt-1 text-sm font-semibold leading-5 text-ink/58">{t(recommendation.title)}</p>
        </div>
        <Utensils className="shrink-0 text-ink/35" size={22} aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {recommendation.items.map((item) => (
          <span key={item} className="rounded-full border border-ink/10 bg-white px-2.5 py-1 text-xs font-bold text-ink/68">
            {t(item)}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["protein", "carbs", "fat"] as const).map((macro) => {
          const percent = afterCompletion[macro];
          const over = percent > 115;
          return (
            <div key={macro} className="rounded-[18px] bg-white p-3">
              <p className="text-xs text-ink/48">{t(macroLabels[macro].label)}</p>
              <p className="mt-1 text-base font-black text-ink">
                {Math.round(recommendation.macros[macro])}{macroLabels[macro].unit}
              </p>
              <p className={`mt-1 text-xs font-bold ${over ? "text-coral" : "text-moss"}`}>{percent}%{over ? " ↑" : ""}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm leading-6 text-ink/62">{localizeRecommendationNote(recommendation.note, t)}</p>
      {recommendation.caution ? <p className="mt-2 text-sm font-semibold text-coral">{t(recommendation.caution)}</p> : null}
      <div className="mt-3 rounded-[18px] border border-moss/12 bg-mint/45 px-3 py-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-moss">{t("吃完预计达成")}</p>
        <p className="mt-1 text-sm font-black text-ink">{t("平均")} {afterCompletion.average}% · {t("热量")} {afterCompletion.calories}% · {t("蛋白")} {afterCompletion.protein}%</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPick}
          className="inline-flex h-10 items-center justify-center rounded-[18px] border border-ink/12 bg-white px-3 text-sm font-black text-ink"
        >
          {t("先看这个")}
        </button>
        <button
          type="button"
          onClick={onChoose}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[18px] bg-moss px-3 text-sm font-black text-white"
        >
          <Check size={16} aria-hidden="true" />
          {t("选择这个")}
        </button>
      </div>
    </article>
  );
}

const categoryLabels: Record<Recommendation["category"], string> = {
  meal: "正餐方案",
  topup: "轻加餐",
  protein: "健身补剂",
  snack: "零食 / 夜宵"
};
