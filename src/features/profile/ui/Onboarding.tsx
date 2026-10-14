"use client";

import type { UserProfile, DayState, MacroMultipliers, MacroMultiplierKey } from "@/shared/domain/types";
import { defaultProfile, defaultDayState, estimateBmr, normalizeMacroMultipliers, calculateRecommendedMacroMultipliers, normalizeFiberGrams, calculateRecommendedFiberGrams, calculateSystemCalorieBudget, calculateCaloriesFromMacroMultipliers, clampMacroMultiplier, clampFiberGrams } from "@/shared/domain/nutrition";
import { goalLabels } from "@/shared/domain/labels";
import { useI18n } from "@/shared/i18n/i18n";
import { useState, useMemo, FormEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { trainingStyles, dietPatterns, goals, goalLogic, trainingDescriptions, dietDescriptions } from "@/features/profile/domain/options";
import { Field } from "@/features/profile/ui/Field";
import { formatNumberInputValue } from "@/shared/ui/number-input";
import { BodyFatGuideDialog } from "@/features/profile/ui/BodyFatGuide";
import { MacroConfirmDialog } from "@/features/profile/ui/MacroConfirmDialog";
import { OnboardingIntro } from "@/features/profile/ui/OnboardingIntro";

type OnboardingProps = {
  initialProfile?: UserProfile;
  initialDay?: DayState;
  onComplete: (profile: UserProfile, day: DayState) => void;
  onBack?: () => void;
  submitLabel?: string;
};

export function Onboarding({
  initialProfile = defaultProfile,
  initialDay = defaultDayState,
  onComplete,
  onBack,
  submitLabel = "进入 Dashboard"
}: OnboardingProps) {
  const { t, language } = useI18n();
  const [profile, setProfile] = useState<UserProfile>(() => {
    const merged = { ...defaultProfile, ...initialProfile };
    return {
      ...merged,
      bmrKcal: initialProfile.bmrKcal || estimateBmr(merged),
      trainingStyle: trainingStyles.includes(merged.trainingStyle) ? merged.trainingStyle : defaultProfile.trainingStyle,
      eatingPattern: dietPatterns.includes(merged.eatingPattern) ? merged.eatingPattern : defaultProfile.eatingPattern
    };
  });
  const [day, setDay] = useState<DayState>(initialDay);
  const [bodyFatOpen, setBodyFatOpen] = useState(false);
  const [macroDialogOpen, setMacroDialogOpen] = useState(false);
  const [macroDraft, setMacroDraft] = useState<MacroMultipliers>(() => {
    const merged = { ...defaultProfile, ...initialProfile };
    return normalizeMacroMultipliers(
      initialProfile.macroMultipliers,
      calculateRecommendedMacroMultipliers(merged, initialDay)
    );
  });
  const [fiberDraft, setFiberDraft] = useState(() => {
    const merged = { ...defaultProfile, ...initialProfile };
    return normalizeFiberGrams(
      initialProfile.fiberGrams,
      calculateRecommendedFiberGrams(merged, initialDay)
    );
  });
  const estimatedBmr = useMemo(() => estimateBmr(profile), [profile]);
  const recommendedMultipliers = useMemo(() => calculateRecommendedMacroMultipliers(profile, day), [profile, day]);
  const recommendedFiberGrams = useMemo(() => calculateRecommendedFiberGrams(profile, day), [profile, day]);
  const calorieBudget = useMemo(() => calculateSystemCalorieBudget(profile, day), [profile, day]);
  const estimatedMacroCalories = useMemo(
    () => calculateCaloriesFromMacroMultipliers(profile.weightKg, macroDraft),
    [macroDraft, profile.weightKg]
  );

  function updateNumber(key: keyof UserProfile, value: string) {
    setProfile((current) => ({
      ...current,
      [key]: Number(value) || 0
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMacroDraft(normalizeMacroMultipliers(profile.macroMultipliers, recommendedMultipliers));
    setFiberDraft(normalizeFiberGrams(profile.fiberGrams, recommendedFiberGrams));
    setMacroDialogOpen(true);
  }

  function applyEstimatedBmr() {
    setProfile((current) => ({ ...current, bmrKcal: estimateBmr(current) }));
  }

  function updateMacroDraft(key: MacroMultiplierKey, value: string) {
    setMacroDraft((current) => ({
      ...current,
      [key]: clampMacroMultiplier(key, Number(value))
    }));
  }

  function updateFiberDraft(value: string) {
    setFiberDraft(clampFiberGrams(Number(value)));
  }

  function resetMacroDraft() {
    setMacroDraft(recommendedMultipliers);
    setFiberDraft(recommendedFiberGrams);
  }

  function confirmMacroDraft() {
    onComplete(
      {
        ...profile,
        macroMultipliers: normalizeMacroMultipliers(macroDraft, recommendedMultipliers),
        fiberGrams: normalizeFiberGrams(fiberDraft, recommendedFiberGrams)
      },
      day
    );
  }

  return (
    <main className={`settings-shell app-shell flex min-h-screen items-center px-4 py-6 sm:px-6 lg:px-8 ${onBack ? "has-settings-back" : ""}`}>
      {onBack ? (
        <button type="button" className="settings-back-button" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          {t("返回上一页")}
        </button>
      ) : null}
      <form onSubmit={submit} className="relative z-10 mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <OnboardingIntro />

        <section className="wellness-card p-5 sm:p-6">
          <div className="grid gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Settings</p>
              <h2 className="mt-1 text-2xl font-black text-ink">{t("系统设置")}</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("身高 cm")} value={profile.heightCm} onChange={(value) => updateNumber("heightCm", value)} />
              <Field label={t("体重 kg")} value={profile.weightKg} onChange={(value) => updateNumber("weightKg", value)} />
              <Field label={t("年龄")} value={profile.age} onChange={(value) => updateNumber("age", value)} />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                {t("性别")}
                <select
                  className="h-12 rounded-[18px] border border-ink/12 bg-paper px-3 text-ink"
                  value={profile.gender}
                  onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value as UserProfile["gender"] }))}
                >
                  <option value="male">{t("男")}</option>
                  <option value="female">{t("女")}</option>
                </select>
              </label>
            </div>

            <div className="rounded-[18px] border border-moss/18 bg-mint/55 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="grid gap-2 text-sm font-bold text-moss">
                  {t("基础代谢 BMR kcal")}
                  <input
                    className="h-12 rounded-[18px] border border-moss/20 bg-white px-3 text-2xl font-black text-ink"
                    type="number"
                    min="0"
                    value={formatNumberInputValue(profile.bmrKcal)}
                    onChange={(event) => updateNumber("bmrKcal", event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={applyEstimatedBmr}
                  className="inline-flex min-h-12 items-center justify-center rounded-[18px] bg-moss px-4 py-2 text-center text-sm font-black leading-5 text-white"
                >
                  {t("如果不记得，点击一键估算")}
                </button>
              </div>
              <p className="mt-2 text-xs font-semibold text-ink/55">{t("根据你当前信息估算约 {calories} kcal，可手动覆盖。", { calories: estimatedBmr })}</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Plan</p>
              <h2 className="mt-1 text-2xl font-black text-ink">{t("目标、训练结构和饮食结构")}</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {goals.map((goal) => (
                <button
                  key={goal.value}
                  type="button"
                  aria-pressed={profile.goal === goal.value}
                  onClick={() => setProfile((current) => ({ ...current, goal: goal.value }))}
                  className={`min-h-24 rounded-[18px] border p-4 text-left transition ${
                    profile.goal === goal.value
                      ? "border-moss bg-moss text-white shadow-soft"
                      : "border-ink/12 bg-paper text-ink hover:border-moss/50"
                  }`}
                >
                  <span className="text-base font-black">{t(goal.label)}</span>
                  <span className={`mt-1 block text-sm leading-5 ${profile.goal === goal.value ? "text-white/78" : "text-ink/58"}`}>
                    {t(goal.detail)}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("目标体重 kg ({goal})", { goal: t(goalLabels[profile.goal]) })} value={profile.targetWeightKg} onChange={(value) => updateNumber("targetWeightKg", value)} />
              <div className="grid gap-2">
                <Field label={t("当前体脂率 %（可选）")} value={profile.bodyFat ?? 0} onChange={(value) => updateNumber("bodyFat", value)} />
                <Field label={t("目标体脂率 %（可选）")} value={profile.targetBodyFat ?? 0} onChange={(value) => updateNumber("targetBodyFat", value)} />
                <button
                  type="button"
                  onClick={() => setBodyFatOpen(true)}
                  className="inline-flex min-h-10 items-center justify-center rounded-[18px] border border-moss/25 bg-mint/50 px-3 py-2 text-center text-sm font-black text-moss"
                >
                  {t("查看体脂率评判标准图")}
                </button>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                {t("训练结构")}
                <select
                  className="h-12 rounded-[18px] border border-ink/12 bg-paper px-3 text-ink"
                  value={profile.trainingStyle}
                  onChange={(event) => {
                    const nextTrainingStyle = event.target.value;
                    setProfile((current) => ({ ...current, trainingStyle: nextTrainingStyle }));
                    if (nextTrainingStyle === "不训练") {
                      setDay((current) => ({ ...current, isTrainingDay: false }));
                    }
                  }}
                >
                  {trainingStyles.map((style) => (
                    <option key={style}>{t(style)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                {t("饮食结构")}
                <select
                  className="h-12 rounded-[18px] border border-ink/12 bg-paper px-3 text-ink"
                  value={profile.eatingPattern}
                  onChange={(event) => setProfile((current) => ({ ...current, eatingPattern: event.target.value }))}
                >
                  {dietPatterns.map((pattern) => (
                    <option key={pattern}>{t(pattern)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 rounded-[18px] border border-ink/10 bg-paper p-4 text-sm leading-6 text-ink/62">
              <p><span className="font-black text-ink">{t("目标逻辑：")}</span>{language === "en" ? " " : ""}{t(goalLogic[profile.goal])}</p>
              <p><span className="font-black text-ink">{t("训练结构：")}</span>{language === "en" ? " " : ""}{t(trainingDescriptions[profile.trainingStyle])}</p>
              <p><span className="font-black text-ink">{t("饮食结构：")}</span>{language === "en" ? " " : ""}{t(dietDescriptions[profile.eatingPattern])}</p>
            </div>
            <button
              type="submit"
              className="settings-primary-action inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-moss px-5 text-sm font-black text-white shadow-soft transition hover:bg-moss/90"
            >
              {t(submitLabel)}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      </form>
      {macroDialogOpen ? (
        <MacroConfirmDialog
          profile={profile}
          day={day}
          estimatedBmr={estimatedBmr}
          recommendedMultipliers={recommendedMultipliers}
          recommendedFiberGrams={recommendedFiberGrams}
          estimatedMacroCalories={estimatedMacroCalories}
          calorieBudget={calorieBudget}
          macroDraft={macroDraft}
          fiberDraft={fiberDraft}
          onMacroChange={updateMacroDraft}
          onFiberChange={updateFiberDraft}
          onReset={resetMacroDraft}
          onClose={() => setMacroDialogOpen(false)}
          onConfirm={confirmMacroDraft}
        />
      ) : null}
      {bodyFatOpen ? <BodyFatGuideDialog onClose={() => setBodyFatOpen(false)} /> : null}
    </main>
  );
}
