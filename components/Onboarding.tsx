"use client";

import { Activity, ArrowRight, Check, HeartPulse, Maximize2, RotateCcw, Scale, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  calculateCaloriesFromMacroMultipliers,
  calculateRecommendedMacroMultipliers,
  calculateRecommendedFiberGrams,
  calculateSystemCalorieBudget,
  clampFiberGrams,
  clampMacroMultiplier,
  defaultDayState,
  defaultProfile,
  dietStatusLabels,
  estimateBmr,
  fiberGramBounds,
  goalLabels,
  macroLabels,
  macroMultiplierBounds,
  macroMultiplierKeys,
  normalizeFiberGrams,
  normalizeMacroMultipliers
} from "@/lib/nutrition";
import type { DayState, GoalType, MacroMultiplierKey, MacroMultipliers, UserProfile } from "@/lib/types";

type OnboardingProps = {
  initialProfile?: UserProfile;
  initialDay?: DayState;
  onComplete: (profile: UserProfile, day: DayState) => void;
  submitLabel?: string;
};

const goals: Array<{ value: GoalType; label: string; detail: string }> = [
  { value: "muscle", label: "增肌", detail: "优先蛋白质和训练日热量盈余" },
  { value: "fat_loss", label: "减脂", detail: "制造热量缺口，同时保留肌肉" },
  { value: "weight_loss", label: "减肥/减重", detail: "更关注体重下降和日常热量控制，适合不训练或轻运动的人" },
  { value: "health", label: "健康管理", detail: "久坐和外卖人群的营养结构优化" }
];

const trainingStyles = ["三分化", "五分化", "功能性训练", "徒手训练", "不训练"];
const dietPatterns = ["三餐正常", "16+8 间歇性断食", "碳循环", "地中海 / 均衡饮食", "外卖 / 便利店为主", "不确定，先按普通模式算"];

const goalLogic: Record<GoalType, string> = {
  muscle: "蛋白质和训练日碳水更高，总热量会略高于消耗，用来支持力量训练和肌肉恢复。",
  fat_loss: "保持较高蛋白质，制造温和热量缺口，优先保住肌肉和训练表现。",
  weight_loss: "更关注体重下降和日常热量控制，推荐会减少奶茶、火锅、烧烤这类高热量快乐选项。",
  health: "目标更均衡，纤维和蛋白质会被优先照顾，适合外卖和久坐人群。"
};

const trainingDescriptions: Record<string, string> = {
  "三分化": "通常按推/拉/腿或上/下/全身拆分，适合每周 3-4 练；大肌群日会提高碳水和热量。",
  "五分化": "每天集中练一个部位，适合训练频率较高的人；系统会更看重当天训练部位和组数。",
  "功能性训练": "力量、心肺和动作能力混合，碳水和总热量会随训练时长上调。",
  "徒手训练": "以自重动作为主，需求中等，系统会根据组数和时长微调。",
  "不训练": "默认休息/轻活动，碳水和热量会降低，但蛋白质不会掉太多。"
};

const dietDescriptions: Record<string, string> = {
  "三餐正常": "默认均衡模式，适合大多数新手，每天按正常三餐或加餐补足。",
  "16+8 间歇性断食": "总营养目标不大变，但推荐更集中到 2-3 餐，每餐蛋白质会更扎实。",
  "碳循环": "每天在日历里选普通日、高碳日、低碳日、高蛋白日或放纵日，系统按当天状态调整比例。",
  "地中海 / 均衡饮食": "更偏蔬菜、水果、优质脂肪和完整正餐，纤维目标会略高。",
  "外卖 / 便利店为主": "推荐会更偏连锁品牌、便利店和容易执行的组合，同时更提醒纤维。",
  "不确定，先按普通模式算": "不用先懂所有饮食结构，先按普通日记录，之后再慢慢调。"
};

const bodyFatRanges = {
  male: [
    ["8-12%", "运动员", "腹肌清晰，线条明显"],
    ["13-17%", "精瘦", "腹肌轮廓明显，脂肪较少"],
    ["18-24%", "普通", "腹部开始有脂肪堆积"],
    ["25-31%", "偏高", "腰腹脂肪明显"],
    ["32%+", "较高", "整体脂肪较多"]
  ],
  female: [
    ["16-20%", "运动型", "线条明显，体脂较低"],
    ["21-24%", "精瘦", "腹部较平，脂肪适中"],
    ["25-31%", "普通", "健康常见范围"],
    ["32-38%", "偏高", "腰腹和臀腿脂肪更明显"],
    ["39%+", "较高", "整体脂肪较多"]
  ]
};

const bodyFatPhotoRefs = [
  {
    title: "男性体脂对照图",
    range: "8% - 40%",
    src: "/images/body-fat-male.png",
    credit: "用户提供参考图"
  },
  {
    title: "女性体脂对照图",
    range: "18% - 45%",
    src: "/images/body-fat-female.png",
    credit: "用户提供参考图"
  }
];

type BodyFatPhotoRef = (typeof bodyFatPhotoRefs)[number];

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

export function Onboarding({
  initialProfile = defaultProfile,
  initialDay = defaultDayState,
  onComplete,
  submitLabel = "进入 Dashboard"
}: OnboardingProps) {
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
  const [expandedBodyFat, setExpandedBodyFat] = useState<BodyFatPhotoRef | null>(null);
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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-8">
      <form onSubmit={submit} className="grid w-full gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="mesh-panel rounded-[8px] border border-ink/10 p-6 shadow-soft sm:p-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-moss/20 bg-white/70 px-3 py-1.5 text-sm font-semibold text-moss">
            <Sparkles size={16} aria-hidden="true" />
            本地系统设置
          </div>
          <h1 className="max-w-xl text-4xl font-black leading-tight text-ink sm:text-5xl">
            你的身体参数，只填一次就好。
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink/68">
            这些信息会保存在当前浏览器里。之后打开网页会直接进入今日任务，不需要每次重新输入。
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[8px] border border-ink/10 bg-white/72 p-4">
              <Activity className="mb-3 text-moss" size={22} aria-hidden="true" />
              <p className="text-sm font-bold">目标驱动</p>
              <p className="mt-1 text-xs leading-5 text-ink/58">增肌、减脂、减肥/减重和健康管理各自计算。</p>
            </div>
            <div className="rounded-[8px] border border-ink/10 bg-white/72 p-4">
              <Scale className="mb-3 text-coral" size={22} aria-hidden="true" />
              <p className="text-sm font-bold">估算即可</p>
              <p className="mt-1 text-xs leading-5 text-ink/58">用小份、标准份、大份替代称重。</p>
            </div>
            <div className="rounded-[8px] border border-ink/10 bg-white/72 p-4">
              <HeartPulse className="mb-3 text-ink" size={22} aria-hidden="true" />
              <p className="text-sm font-bold">快乐补齐</p>
              <p className="mt-1 text-xs leading-5 text-ink/58">今日状态在日历里设置，推荐会跟着变。</p>
            </div>
          </div>
        </section>

        <section className="rounded-[8px] border border-ink/10 bg-white/86 p-5 shadow-soft sm:p-6">
          <div className="grid gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Settings</p>
              <h2 className="mt-1 text-2xl font-black text-ink">系统设置</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="身高 cm" value={profile.heightCm} onChange={(value) => updateNumber("heightCm", value)} />
              <Field label="体重 kg" value={profile.weightKg} onChange={(value) => updateNumber("weightKg", value)} />
              <Field label="年龄" value={profile.age} onChange={(value) => updateNumber("age", value)} />
              <label className="grid gap-2 text-sm font-semibold text-ink">
                性别
                <select
                  className="h-12 rounded-[8px] border border-ink/12 bg-paper px-3 text-ink"
                  value={profile.gender}
                  onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value as UserProfile["gender"] }))}
                >
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </label>
            </div>

            <div className="rounded-[8px] border border-moss/18 bg-mint/55 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="grid gap-2 text-sm font-bold text-moss">
                  基础代谢 BMR kcal
                  <input
                    className="h-12 rounded-[8px] border border-moss/20 bg-white px-3 text-2xl font-black text-ink"
                    type="number"
                    min="0"
                    value={formatNumberInputValue(profile.bmrKcal)}
                    onChange={(event) => updateNumber("bmrKcal", event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={applyEstimatedBmr}
                  className="inline-flex min-h-12 items-center justify-center rounded-[8px] bg-moss px-4 py-2 text-center text-sm font-black leading-5 text-white"
                >
                  如果不记得，点击一键估算
                </button>
              </div>
              <p className="mt-2 text-xs font-semibold text-ink/55">根据你当前信息估算约 {estimatedBmr} kcal，可手动覆盖。</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Plan</p>
              <h2 className="mt-1 text-2xl font-black text-ink">目标、训练结构和饮食结构</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {goals.map((goal) => (
                <button
                  key={goal.value}
                  type="button"
                  aria-pressed={profile.goal === goal.value}
                  onClick={() => setProfile((current) => ({ ...current, goal: goal.value }))}
                  className={`min-h-24 rounded-[8px] border p-4 text-left transition ${
                    profile.goal === goal.value
                      ? "border-moss bg-moss text-white shadow-soft"
                      : "border-ink/12 bg-paper text-ink hover:border-moss/50"
                  }`}
                >
                  <span className="text-base font-black">{goal.label}</span>
                  <span className={`mt-1 block text-sm leading-5 ${profile.goal === goal.value ? "text-white/78" : "text-ink/58"}`}>
                    {goal.detail}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`目标体重 kg (${goalLabels[profile.goal]})`} value={profile.targetWeightKg} onChange={(value) => updateNumber("targetWeightKg", value)} />
              <div className="grid gap-2">
                <Field label="当前体脂率 %（可选）" value={profile.bodyFat ?? 0} onChange={(value) => updateNumber("bodyFat", value)} />
                <Field label="目标体脂率 %（可选）" value={profile.targetBodyFat ?? 0} onChange={(value) => updateNumber("targetBodyFat", value)} />
                <button
                  type="button"
                  onClick={() => setBodyFatOpen(true)}
                  className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-moss/25 bg-mint/50 px-3 text-sm font-black text-moss"
                >
                  查看体脂率评判标准图
                </button>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                训练结构
                <select
                  className="h-12 rounded-[8px] border border-ink/12 bg-paper px-3 text-ink"
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
                    <option key={style}>{style}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                饮食结构
                <select
                  className="h-12 rounded-[8px] border border-ink/12 bg-paper px-3 text-ink"
                  value={profile.eatingPattern}
                  onChange={(event) => setProfile((current) => ({ ...current, eatingPattern: event.target.value }))}
                >
                  {dietPatterns.map((pattern) => (
                    <option key={pattern}>{pattern}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 rounded-[8px] border border-ink/10 bg-paper p-4 text-sm leading-6 text-ink/62">
              <p><span className="font-black text-ink">目标逻辑：</span>{goalLogic[profile.goal]}</p>
              <p><span className="font-black text-ink">训练结构：</span>{trainingDescriptions[profile.trainingStyle]}</p>
              <p><span className="font-black text-ink">饮食结构：</span>{dietDescriptions[profile.eatingPattern]}</p>
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-coral px-5 text-sm font-black text-white shadow-soft transition hover:bg-coral/90"
            >
              {submitLabel}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      </form>
      {macroDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4 py-5 backdrop-blur-sm">
          <section className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[8px] border border-ink/10 bg-white shadow-soft">
            <div className="min-h-0 overflow-auto p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-moss/20 bg-mint/65 px-3 py-1.5 text-sm font-black text-moss">
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    宏量倍数确认
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-ink sm:text-3xl">保存前，确认你的每日营养倍数</h2>
                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ink/62">
                    根据你的身高 {profile.heightCm}cm、体重 {profile.weightKg}kg、基础代谢 {profile.bmrKcal || estimatedBmr}kcal、体脂率 {formatOptionalPercent(profile.bodyFat)}、{profile.trainingStyle} 和 {profile.eatingPattern}，系统推荐你先使用：
                    蛋白质 {formatMultiplier(recommendedMultipliers.protein)}、碳水 {formatMultiplier(recommendedMultipliers.carbs)}、脂肪 {formatMultiplier(recommendedMultipliers.fat)}、膳食纤维 {recommendedFiberGrams}g/天。热量目标按系统预算计算：{calorieBudget} kcal。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMacroDialogOpen(false)}
                  aria-label="关闭宏量倍数确认"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-ink/12 bg-paper text-ink"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <MacroContext label="目标" value={goalLabels[profile.goal]} />
                <MacroContext label="今日状态" value={day.isTrainingDay ? `${day.trainingPart}训练` : "休息"} />
                <MacroContext label="饮食日" value={dietStatusLabels[day.dietStatus].label} />
                <MacroContext label="体脂目标" value={formatOptionalPercent(profile.targetBodyFat)} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {macroMultiplierKeys.map((macro) => (
                  <MacroMultiplierControl
                    key={macro}
                    macro={macro}
                    value={macroDraft[macro]}
                    recommended={recommendedMultipliers[macro]}
                    weightKg={profile.weightKg}
                    onChange={(value) => updateMacroDraft(macro, value)}
                  />
                ))}
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
                <FiberControl
                  value={fiberDraft}
                  recommended={recommendedFiberGrams}
                  onChange={updateFiberDraft}
                />
                <CalorieEstimatePanel
                  macroCalories={estimatedMacroCalories}
                  calorieBudget={calorieBudget}
                  proteinGrams={macroGrams(profile.weightKg, macroDraft.protein)}
                  carbGrams={macroGrams(profile.weightKg, macroDraft.carbs)}
                  fatGrams={macroGrams(profile.weightKg, macroDraft.fat)}
                />
              </div>

              <div className="mt-5 rounded-[8px] border border-moss/15 bg-mint/45 p-4">
                <p className="text-sm font-black text-moss">当前确认后会保存为：</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {macroMultiplierKeys.map((macro) => (
                    <div key={macro} className="rounded-[8px] bg-white/80 px-3 py-2">
                      <p className="text-xs font-bold text-ink/48">{macroLabels[macro].label}</p>
                      <p className="mt-1 text-lg font-black text-ink">
                        {formatMultiplier(macroDraft[macro])}
                        <span className="ml-2 text-sm text-ink/48">{macroGrams(profile.weightKg, macroDraft[macro])}g/天</span>
                      </p>
                    </div>
                  ))}
                  <div className="rounded-[8px] bg-white/80 px-3 py-2">
                    <p className="text-xs font-bold text-ink/48">{macroLabels.fiber.label}</p>
                    <p className="mt-1 text-lg font-black text-ink">{fiberDraft}g/天</p>
                  </div>
                  <div className="rounded-[8px] bg-white/80 px-3 py-2">
                    <p className="text-xs font-bold text-ink/48">{macroLabels.calories.label}</p>
                    <p className="mt-1 text-lg font-black text-ink">{calorieBudget}kcal</p>
                    <p className="mt-1 text-xs font-bold text-ink/42">系统预算</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-ink/10 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={resetMacroDraft}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-moss/20 bg-paper px-4 text-sm font-black text-moss"
              >
                <RotateCcw size={16} aria-hidden="true" />
                使用系统推荐
              </button>
              <button
                type="button"
                onClick={() => setMacroDialogOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-ink/12 bg-white px-4 text-sm font-black text-ink"
              >
                返回修改设置
              </button>
              <button
                type="button"
                onClick={confirmMacroDraft}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-coral px-5 text-sm font-black text-white shadow-soft transition hover:bg-coral/90"
              >
                <Check size={17} aria-hidden="true" />
                确认并保存
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {bodyFatOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4 backdrop-blur-sm">
          <section className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-[8px] border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Body Fat Guide</p>
                <h2 className="mt-1 text-2xl font-black text-ink">体脂率评判标准图</h2>
                <p className="mt-2 text-sm leading-6 text-ink/58">用真人体脂对照图做视觉参考，再配合区间判断目标。不同身高、骨架和肌肉量会让观感有差异。</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBodyFatOpen(false);
                  setExpandedBodyFat(null);
                }}
                aria-label="关闭体脂率参考"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-ink/12 bg-paper text-ink"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mb-5 grid gap-3 md:grid-cols-2">
              {bodyFatPhotoRefs.map((photo) => (
                <BodyFatPhoto key={photo.src} photo={photo} onExpand={() => setExpandedBodyFat(photo)} />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <BodyFatColumn title="男生参考" rows={bodyFatRanges.male} />
              <BodyFatColumn title="女生参考" rows={bodyFatRanges.female} />
            </div>
            <p className="mt-4 text-xs leading-5 text-ink/48">
              说明：体脂率视觉参考仅用于自我估算，不作为医学诊断；同样体脂率在不同肌肉量、骨架和水分状态下会有明显观感差异。
            </p>
          </section>
        </div>
      ) : null}
      {expandedBodyFat ? (
        <div className="fixed inset-0 z-[60] bg-ink/78 p-3 backdrop-blur-sm sm:p-6">
          <section className="flex h-full flex-col rounded-[8px] border border-white/18 bg-white shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Body Fat Guide</p>
                <h3 className="text-lg font-black text-ink">{expandedBodyFat.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setExpandedBodyFat(null)}
                aria-label="关闭放大图"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-ink/12 bg-paper text-ink"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-paper p-3 sm:p-5">
              <img
                src={expandedBodyFat.src}
                alt={`${expandedBodyFat.title}放大图`}
                className="mx-auto h-auto w-full max-w-6xl rounded-[8px] bg-white object-contain shadow-soft"
              />
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function BodyFatPhoto({
  photo,
  onExpand
}: {
  photo: BodyFatPhotoRef;
  onExpand: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-ink/10 bg-paper">
      <button
        type="button"
        onClick={onExpand}
        aria-label={`放大查看${photo.title}`}
        className="group relative block w-full cursor-zoom-in bg-white"
      >
        <img src={photo.src} alt={photo.title} className="h-full max-h-[64vh] w-full object-contain" loading="lazy" />
        <span className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-ink/10 bg-white/90 text-moss shadow-soft transition group-hover:scale-105">
          <Maximize2 size={18} aria-hidden="true" />
        </span>
      </button>
      <div className="p-3">
        <p className="text-sm font-black text-ink">{photo.title}</p>
        <p className="mt-1 text-xs font-bold text-coral">{photo.range}</p>
        <p className="mt-2 text-xs font-semibold text-ink/48">{photo.credit}</p>
      </div>
    </article>
  );
}

function BodyFatColumn({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="rounded-[8px] border border-ink/10 bg-paper p-4">
      <h3 className="text-lg font-black text-ink">{title}</h3>
      <div className="mt-4 grid gap-3">
        {rows.map(([range, label, detail], index) => (
          <div key={range} className="grid gap-2 rounded-[8px] border border-ink/8 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-ink">{range}</p>
              <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-black text-moss">{label}</span>
            </div>
            <div className="h-2 rounded-full bg-ink/10">
              <div className="h-2 rounded-full bg-coral" style={{ width: `${24 + index * 16}%` }} />
            </div>
            <p className="text-sm leading-5 text-ink/58">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroContext({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-ink/10 bg-paper px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/42">{label}</p>
      <p className="mt-1 text-sm font-black text-ink">{value}</p>
    </div>
  );
}

function MacroMultiplierControl({
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
  const bounds = macroMultiplierBounds[macro];

  return (
    <article className="rounded-[8px] border border-ink/10 bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-ink">{macroLabels[macro].label}</p>
          <p className="mt-1 text-xs font-bold text-ink/50">推荐 {formatMultiplier(recommended)} · {macroGrams(weightKg, recommended)}g/天</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${macroPillClass[macro]}`}>
          {formatMultiplier(value)}
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
          aria-label={`${macroLabels[macro].label}体重倍数`}
        />
        <div className="mt-2 flex items-center justify-between text-xs font-bold text-ink/42">
          <span>{formatMultiplier(bounds.min)}</span>
          <span>{formatMultiplier(bounds.max)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-[8px] bg-white/78 px-3 py-2">
        <span className="text-xs font-bold text-ink/45">目标克数</span>
        <strong className="text-base text-ink">{macroGrams(weightKg, value)}g/天</strong>
      </div>
    </article>
  );
}

function FiberControl({
  value,
  recommended,
  onChange
}: {
  value: number;
  recommended: number;
  onChange: (value: string) => void;
}) {
  return (
    <article className="rounded-[8px] border border-ink/10 bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-ink">{macroLabels.fiber.label}</p>
          <p className="mt-1 text-xs font-bold text-ink/50">推荐 {recommended}g/天 · 可按肠胃耐受微调</p>
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
          aria-label="膳食纤维每日克数"
        />
        <div className="mt-2 flex items-center justify-between text-xs font-bold text-ink/42">
          <span>{fiberGramBounds.min}g</span>
          <span>{fiberGramBounds.max}g</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-[8px] bg-white/78 px-3 py-2">
        <span className="text-xs font-bold text-ink/45">每日目标</span>
        <strong className="text-base text-ink">{value}g/天</strong>
      </div>
    </article>
  );
}

function CalorieEstimatePanel({
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
  const delta = macroCalories - calorieBudget;

  return (
    <article className="rounded-[8px] border border-ink/10 bg-ink p-4 text-white">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-citrus">Calorie Budget</p>
      <h3 className="mt-2 text-2xl font-black">{calorieBudget} kcal</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-white/72">
        系统热量目标按 BMR、训练计划和饮食目标估算。根据你当前调整后的蛋白质、碳水和脂肪，折算热量为 {macroCalories} kcal，{formatCalorieDelta(delta)}。
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MacroFormula label="蛋白质" grams={proteinGrams} kcal={proteinGrams * 4} />
        <MacroFormula label="碳水" grams={carbGrams} kcal={carbGrams * 4} />
        <MacroFormula label="脂肪" grams={fatGrams} kcal={fatGrams * 9} />
      </div>
    </article>
  );
}

function formatCalorieDelta(delta: number) {
  const absDelta = Math.abs(delta);

  if (absDelta <= 25) return "与系统预算基本贴合";
  return delta > 0 ? `比系统预算高 ${absDelta} kcal` : `比系统预算低 ${absDelta} kcal`;
}

function MacroFormula({ label, grams, kcal }: { label: string; grams: number; kcal: number }) {
  return (
    <div className="rounded-[8px] bg-white/10 px-3 py-2">
      <p className="text-xs font-bold text-white/50">{label}</p>
      <p className="mt-1 text-sm font-black">{grams}g</p>
      <p className="mt-0.5 text-xs font-semibold text-white/55">{Math.round(kcal)} kcal</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      <input
        className="h-12 rounded-[8px] border border-ink/12 bg-paper px-3 text-ink"
        type="number"
        min="0"
        value={formatNumberInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function formatNumberInputValue(value: number) {
  if (!Number.isFinite(value) || value === 0) return "";
  return value;
}

function formatOptionalPercent(value?: number) {
  if (!value || value <= 0) return "未填写";
  return `${value}%`;
}

function formatMultiplier(value: number) {
  return `${value.toFixed(2)} 倍`;
}

function macroGrams(weightKg: number, multiplier: number) {
  return Math.round(Math.max(0, weightKg) * multiplier);
}
