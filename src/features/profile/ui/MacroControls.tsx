"use client";

import type { MacroMultiplierKey } from "@/shared/domain/types";
import { useI18n } from "@/shared/i18n/i18n";
import { macroMultiplierBounds, fiberGramBounds } from "@/shared/domain/nutrition";
import { macroLabels } from "@/shared/domain/labels";
import type { Language } from "@/shared/i18n/i18n-utils";
import { formatMultiplier, macroGrams, formatDailyGrams } from "@/features/profile/domain/format";

const macroAccentColor: Record<MacroMultiplierKey, string> = {
  protein: "#246b4f",
  carbs: "#d9a900",
  fat: "#ff6f5e"
};

const macroPillClass: Record<MacroMultiplierKey, string> = {
  protein: "bg-moss/10 text-moss",
  carbs: "bg-citrus/25 text-ink",
  fat: "bg-coral/10 text-coral"
};

export function MacroContext({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-ink/10 bg-paper px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/42">{label}</p>
      <p className="mt-1 text-sm font-black text-ink">{value}</p>
    </div>
  );
}

export function MacroMultiplierControl({
  macro,
  value,
  recommended,
  weightKg,
  onChange
}: {
  macro: MacroMultiplierKey;
  value: number;
  recommended: number;
  weightKg: number;
  onChange: (value: string) => void;
}) {
  const { t, language } = useI18n();
  const bounds = macroMultiplierBounds[macro];

  return (
    <article className="rounded-[18px] border border-ink/10 bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-ink">{t(macroLabels[macro].label)}</p>
          <p className="mt-1 text-xs font-bold text-ink/50">{t("推荐 {multiplier} · {grams}g/天", { multiplier: formatMultiplier(recommended, language), grams: macroGrams(weightKg, recommended) })}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${macroPillClass[macro]}`}>
          {formatMultiplier(value, language)}
        </span>
      </div>

      <div className="mt-5">
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-2 w-full cursor-pointer"
          style={{ accentColor: macroAccentColor[macro] }}
          aria-label={`${t(macroLabels[macro].label)} ${t("体重倍数")}`}
        />
        <div className="mt-2 flex items-center justify-between text-xs font-bold text-ink/42">
          <span>{formatMultiplier(bounds.min, language)}</span>
          <span>{formatMultiplier(bounds.max, language)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] bg-white/78 px-3 py-2">
        <span className="text-xs font-bold text-ink/45">{t("目标克数")}</span>
        <strong className="text-base text-ink">{formatDailyGrams(macroGrams(weightKg, value), language)}</strong>
      </div>
    </article>
  );
}

export function FiberControl({
  value,
  recommended,
  onChange
}: {
  value: number;
  recommended: number;
  onChange: (value: string) => void;
}) {
  const { t, language } = useI18n();
  return (
    <article className="rounded-[18px] border border-ink/10 bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-ink">{t(macroLabels.fiber.label)}</p>
          <p className="mt-1 text-xs font-bold text-ink/50">{t("推荐 {grams}g/天 · 可按肠胃耐受微调", { grams: recommended })}</p>
        </div>
        <span className="rounded-full bg-skyglass px-2.5 py-1 text-xs font-black text-ink">
          {value}g
        </span>
      </div>

      <div className="mt-5">
        <input
          type="range"
          min={fiberGramBounds.min}
          max={fiberGramBounds.max}
          step={fiberGramBounds.step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-2 w-full cursor-pointer"
          style={{ accentColor: "#4e8fa8" }}
          aria-label={t("膳食纤维每日克数")}
        />
        <div className="mt-2 flex items-center justify-between text-xs font-bold text-ink/42">
          <span>{fiberGramBounds.min}g</span>
          <span>{fiberGramBounds.max}g</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] bg-white/78 px-3 py-2">
        <span className="text-xs font-bold text-ink/45">{t("每日目标")}</span>
        <strong className="text-base text-ink">{formatDailyGrams(value, language)}</strong>
      </div>
    </article>
  );
}

export function CalorieEstimatePanel({
  macroCalories,
  calorieBudget,
  proteinGrams,
  carbGrams,
  fatGrams
}: {
  macroCalories: number;
  calorieBudget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}) {
  const { t, language } = useI18n();
  const delta = macroCalories - calorieBudget;

  return (
    <article className="rounded-[18px] border border-ink/10 bg-ink p-4 text-white">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-citrus">Calorie Budget</p>
      <h3 className="mt-2 text-2xl font-black" data-testid="calorie-target">{macroCalories} kcal</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-white/72">
        {t("当前热量按蛋白质 × 4、碳水 × 4、脂肪 × 9 同步计算。系统初始参考预算为 {calorieBudget} kcal，当前目标{delta}。膳食纤维单独设置，不重复计入热量。", {
          calorieBudget,
          delta: formatCalorieDelta(delta, language)
        })}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MacroFormula label={t("蛋白质")} grams={proteinGrams} kcal={proteinGrams * 4} />
        <MacroFormula label={t("碳水")} grams={carbGrams} kcal={carbGrams * 4} />
        <MacroFormula label={t("脂肪")} grams={fatGrams} kcal={fatGrams * 9} />
      </div>
    </article>
  );
}

function formatCalorieDelta(delta: number, language: Language) {
  const absDelta = Math.abs(delta);

  if (absDelta <= 25) return language === "en" ? "in line with the system budget" : "与系统预算基本贴合";
  return delta > 0
    ? language === "en" ? `${absDelta} kcal above the system budget` : `比系统预算高 ${absDelta} kcal`
    : language === "en" ? `${absDelta} kcal below the system budget` : `比系统预算低 ${absDelta} kcal`;
}

function MacroFormula({ label, grams, kcal }: { label: string; grams: number; kcal: number }) {
  return (
    <div className="rounded-[18px] bg-white/10 px-3 py-2">
      <p className="text-xs font-bold text-white/50">{label}</p>
      <p className="mt-1 text-sm font-black">{grams}g</p>
      <p className="mt-0.5 text-xs font-semibold text-white/55">{Math.round(kcal)} kcal</p>
    </div>
  );
}
