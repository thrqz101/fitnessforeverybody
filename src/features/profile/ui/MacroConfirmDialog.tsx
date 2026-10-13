"use client";

import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/shared/i18n/i18n";
import { macroMultiplierKeys } from "@/shared/domain/nutrition";
import { dietStatusLabels, goalLabels, macroLabels } from "@/shared/domain/labels";
import type { DayState, MacroMultiplierKey, MacroMultipliers, UserProfile } from "@/shared/domain/types";
import { formatDailyGrams, formatMultiplier, formatOptionalPercent, macroGrams } from "@/features/profile/domain/format";
import { CalorieEstimatePanel, FiberControl, MacroContext, MacroMultiplierControl } from "@/features/profile/ui/MacroControls";

type MacroConfirmDialogProps = {
  profile: UserProfile;
  day: DayState;
  estimatedBmr: number;
  recommendedMultipliers: MacroMultipliers;
  recommendedFiberGrams: number;
  estimatedMacroCalories: number;
  calorieBudget: number;
  macroDraft: MacroMultipliers;
  fiberDraft: number;
  onMacroChange: (key: MacroMultiplierKey, value: string) => void;
  onFiberChange: (value: string) => void;
  onReset: () => void;
  onClose: () => void;
  onConfirm: () => void;
};

/** Final step of the settings form: review and adjust the daily macro multipliers before saving. */
export function MacroConfirmDialog({
  profile,
  day,
  estimatedBmr,
  recommendedMultipliers,
  recommendedFiberGrams,
  estimatedMacroCalories,
  calorieBudget,
  macroDraft,
  fiberDraft,
  onMacroChange,
  onFiberChange,
  onReset,
  onClose,
  onConfirm
}: MacroConfirmDialogProps) {
  const { t, language } = useI18n();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4 py-5 backdrop-blur-sm">
      <section className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[18px] border border-ink/10 bg-white shadow-soft">
        <div className="min-h-0 overflow-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-moss/20 bg-mint/65 px-3 py-1.5 text-sm font-black text-moss">
                <SlidersHorizontal size={16} aria-hidden="true" />
                {t("宏量倍数确认")}
              </div>
              <h2 className="mt-3 text-2xl font-black text-ink sm:text-3xl">{t("保存前，确认你的每日营养倍数")}</h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ink/62">
                {t("根据你的身高 {height}cm、体重 {weight}kg、基础代谢 {bmr}kcal、体脂率 {bodyFat}、{trainingStyle} 和 {eatingPattern}，系统推荐你先使用：", {
                  height: profile.heightCm,
                  weight: profile.weightKg,
                  bmr: profile.bmrKcal || estimatedBmr,
                  bodyFat: formatOptionalPercent(profile.bodyFat, language),
                  trainingStyle: t(profile.trainingStyle),
                  eatingPattern: t(profile.eatingPattern)
                })}
                {t("蛋白质")} {formatMultiplier(recommendedMultipliers.protein, language)}、{t("碳水")} {formatMultiplier(recommendedMultipliers.carbs, language)}、{t("脂肪")} {formatMultiplier(recommendedMultipliers.fat, language)}、{t("膳食纤维")} {formatDailyGrams(recommendedFiberGrams, language)}。{t("热量目标随当前营养素同步计算：{calories} kcal。", { calories: estimatedMacroCalories })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("关闭宏量倍数确认")}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-ink/12 bg-paper text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <MacroContext label={t("目标")} value={t(goalLabels[profile.goal])} />
            <MacroContext label={t("今日状态")} value={day.isTrainingDay ? `${t(day.trainingPart)}${t("训练")}` : t("休息")} />
            <MacroContext label={t("饮食日")} value={t(dietStatusLabels[day.dietStatus].label)} />
            <MacroContext label={t("体脂目标")} value={formatOptionalPercent(profile.targetBodyFat, language)} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {macroMultiplierKeys.map((macro) => (
              <MacroMultiplierControl
                key={macro}
                macro={macro}
                value={macroDraft[macro]}
                recommended={recommendedMultipliers[macro]}
                weightKg={profile.weightKg}
                onChange={(value) => onMacroChange(macro, value)}
              />
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
            <FiberControl
              value={fiberDraft}
              recommended={recommendedFiberGrams}
              onChange={onFiberChange}
            />
            <CalorieEstimatePanel
              macroCalories={estimatedMacroCalories}
              calorieBudget={calorieBudget}
              proteinGrams={macroGrams(profile.weightKg, macroDraft.protein)}
              carbGrams={macroGrams(profile.weightKg, macroDraft.carbs)}
              fatGrams={macroGrams(profile.weightKg, macroDraft.fat)}
            />
          </div>

          <div className="mt-5 rounded-[18px] border border-moss/15 bg-mint/45 p-4">
            <p className="text-sm font-black text-moss">{t("当前确认后会保存为：")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {macroMultiplierKeys.map((macro) => (
                <div key={macro} className="rounded-[18px] bg-white/80 px-3 py-2">
                  <p className="text-xs font-bold text-ink/48">{t(macroLabels[macro].label)}</p>
                  <p className="mt-1 text-lg font-black text-ink">
                    {formatMultiplier(macroDraft[macro], language)}
                    <span className="ml-2 text-sm text-ink/48">{formatDailyGrams(macroGrams(profile.weightKg, macroDraft[macro]), language)}</span>
                  </p>
                </div>
              ))}
              <div className="rounded-[18px] bg-white/80 px-3 py-2">
                <p className="text-xs font-bold text-ink/48">{t(macroLabels.fiber.label)}</p>
                <p className="mt-1 text-lg font-black text-ink">{formatDailyGrams(fiberDraft, language)}</p>
              </div>
              <div className="rounded-[18px] bg-white/80 px-3 py-2">
                <p className="text-xs font-bold text-ink/48">{t(macroLabels.calories.label)}</p>
                <p className="mt-1 text-lg font-black text-ink" data-testid="saved-calorie-target">{estimatedMacroCalories}kcal</p>
                <p className="mt-1 text-xs font-bold text-ink/42">{t("按当前营养素计算")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-ink/10 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-moss/20 bg-paper px-4 text-sm font-black text-moss"
          >
            <RotateCcw size={16} aria-hidden="true" />
            {t("使用系统推荐")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-ink/12 bg-white px-4 text-sm font-black text-ink"
          >
            {t("返回修改设置")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="settings-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-moss px-5 text-sm font-black text-white shadow-soft transition hover:bg-moss/90"
          >
            <Check size={17} aria-hidden="true" />
            {t("确认并保存")}
          </button>
        </div>
      </section>
    </div>
  );
}
