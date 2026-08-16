"use client";

import {
  ArrowRight,
  Check,
  ChevronRight,
  Flame,
  Loader2,
  MessageSquareText,
  ScanLine,
  Sparkles,
  Trash2,
  Utensils
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getLocalizedFoodField } from "@/lib/translations";
import { pick, type Language } from "@/lib/i18n-utils";
import { completion, dietStatusLabels, estimateBmr, goalLabels, macroKeys, macroLabels } from "@/lib/nutrition";
import type { DayState, FoodLogItem, MacroKey, MacroTotals, UserProfile } from "@/lib/types";

type DashboardProps = {
  profile: UserProfile;
  day: DayState;
  targets: MacroTotals;
  totals: MacroTotals;
  gaps: MacroTotals;
  foods: FoodLogItem[];
  todayLabel: string;
  onNavigate: (view: "calendar" | "recommend" | "settings") => void;
  onDayChange: (day: DayState) => void;
  onAddFoods: (foods: FoodLogItem[]) => void;
  onRemoveFood: (id: string) => void;
  onSaveFood: (id: string) => void;
  onClearDrafts: () => void;
};

type RecognitionNoticeState =
  | { key: string; vars?: Record<string, string | number> }
  | { text: string };

const quickExamples = [
  "一份鸡胸肉沙拉和拿铁",
  "麦当劳巨无霸套餐",
  "牛肉麻辣烫，加宽粉",
  "酸奶、香蕉和一勺蛋白粉"
];

const ringTone: Record<MacroKey, string> = {
  protein: "#4f805d",
  carbs: "#e0b24c",
  fat: "#eb765f",
  calories: "#24362a",
  fiber: "#83aeb3"
};

export function Dashboard({
  profile,
  day,
  targets,
  totals,
  gaps,
  foods,
  todayLabel,
  onNavigate,
  onDayChange,
  onAddFoods,
  onRemoveFood,
  onSaveFood,
  onClearDrafts
}: DashboardProps) {
  const { t, language } = useI18n();
  const [mealDescription, setMealDescription] = useState("");
  const [recognitionNotice, setRecognitionNotice] = useState<RecognitionNoticeState | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [selectedMacro, setSelectedMacro] = useState<MacroKey>("protein");
  const draftFoods = foods.filter((food) => !food.savedToCalendar);
  const savedFoods = foods.filter((food) => food.savedToCalendar);
  const bmr = profile.bmrKcal > 0 ? profile.bmrKcal : estimateBmr(profile);
  const animatedTotals = useAnimatedMacroTotals(totals);
  const overallProgress = useMemo(
    () => Math.round(macroKeys.reduce((sum, macro) => sum + Math.min(completion(animatedTotals[macro], targets[macro]), 100), 0) / macroKeys.length),
    [animatedTotals, targets]
  );
  const selectedMacroPercent = completion(animatedTotals[selectedMacro], targets[selectedMacro]);
  const selectedMacroGap = Math.max(0, targets[selectedMacro] - animatedTotals[selectedMacro]);
  const selectedContributors = [...savedFoods]
    .filter((food) => food.macros[selectedMacro] > 0)
    .sort((left, right) => right.macros[selectedMacro] - left.macros[selectedMacro])
    .slice(0, 3);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/food-ai", { method: "GET", signal: controller.signal }).catch(() => undefined);
    }, 800);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  async function recognizeMeal() {
    const description = mealDescription.trim();
    if (!description) {
      setRecognitionNotice({ key: "先告诉我你吃了什么，品牌、份量和配菜越具体越好。" });
      return;
    }

    const form = new FormData();
    form.append("description", description);
    form.append("lang", language);
    setIsRecognizing(true);
    setRecognitionNotice({ key: "AI 正在拆解食材、份量和营养结构…" });

    try {
      const aiResult = await requestFoodAi(form, language);
      if (!aiResult.ok || !aiResult.result?.ok) {
        setRecognitionNotice({ text: withRetryHint(aiResult.message || aiResult.result?.message || t("AI 这次没算准。"), language) });
        return;
      }
      const recognizedFoods = aiResult.result.foods ?? [];
      if (!aiResult.result.isFoodRelated || !recognizedFoods.length) {
        setRecognitionNotice({ key: "这段描述里没有识别到明确食物，请补充菜名或份量。" });
        return;
      }
      onAddFoods(recognizedFoods);
      setMealDescription("");
      setRecognitionNotice({ key: "识别完成：{count} 个食物已进入确认区，营养变化正在计算。", vars: { count: recognizedFoods.length } });
    } catch {
      setRecognitionNotice({ text: withRetryHint(t("AI 连接暂时没有响应。"), language) });
    } finally {
      setIsRecognizing(false);
    }
  }

  return (
    <div className="nutrition-experience">
      <section className="nutrition-console" aria-label={t("AI 饮食识别与营养进度")}>
      <section className="food-vision-hero">
        <img
          src="/images/wellness-hero-v2.png"
          alt={t("摆放着三文鱼、牛油果、蔬菜和谷物的均衡餐")}
          className="food-vision-hero__image"
        />
        <div className="food-vision-hero__veil" />
        <div className="food-vision-hero__content">
          <div className="flex flex-wrap items-center gap-2">
            <span className="experience-kicker experience-kicker--light"><Sparkles size={14} /> AI Food Vision</span>
            <span className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
              {todayLabel}
            </span>
          </div>
          <h1>{t("记录生活，")}<br />{t("看懂每一餐。")}</h1>
          <p>{t("输入食物、品牌和份量，AI 会识别食材并估算这一餐的营养。")}</p>

          <div className="food-composer">
            <div className="food-composer__field">
              <MessageSquareText size={20} aria-hidden="true" />
              <textarea
                value={mealDescription}
                onChange={(event) => setMealDescription(event.target.value)}
                placeholder={t("比如：一碗牛肉麻辣烫，加宽粉、豆腐皮和青菜…")}
                aria-label={t("描述你吃的食物")}
              />
            </div>
            <button type="button" onClick={recognizeMeal} disabled={isRecognizing} className="food-composer__submit">
              {isRecognizing ? <Loader2 className="animate-spin" size={20} /> : <ScanLine size={20} />}
              <span>{isRecognizing ? t("正在识别") : t("分析这一餐")}</span>
              {!isRecognizing ? <ArrowRight size={18} /> : null}
            </button>
          </div>

          <div className="food-examples" aria-label={t("食物描述示例")}>
            {quickExamples.map((example) => (
              <button key={example} type="button" onClick={() => setMealDescription(example)}>{t(example)}</button>
            ))}
          </div>
          {recognitionNotice ? <div className="recognition-toast">{"key" in recognitionNotice ? t(recognitionNotice.key, recognitionNotice.vars) : recognitionNotice.text}</div> : null}
        </div>
      </section>

      <section className="experience-section meal-timeline">
        <div className="section-heading">
          <div>
            <span className="experience-kicker">Today&apos;s journal</span>
            <h2>{t("今日饮食记录")}</h2>
          </div>
          <div className="meal-timeline__summary">
            <span><strong>{foods.length}</strong> {t("今日输入")}</span>
            <span><strong>{savedFoods.length}</strong> {t("已计入")}</span>
            {draftFoods.length ? <button type="button" className="text-action text-coral" onClick={onClearDrafts}><Trash2 size={15} /> {t("清空待确认")}</button> : null}
          </div>
        </div>

        {!foods.length ? (
          <div className="empty-meal-state">
            <div className="empty-meal-state__icon"><Utensils size={30} /></div>
            <h3>{t("还没有饮食记录")}</h3>
            <p>{t("在页面上方输入食物，识别结果和营养变化会显示在这里。")}</p>
          </div>
        ) : (
          <div className="meal-rail horizontal-card-flow">
            {draftFoods.map((food) => (
              <article key={food.id} className="meal-entry meal-entry--draft">
                <div className="meal-entry__top">
                  <span>{t("待确认")}</span>
                  <button type="button" onClick={() => onRemoveFood(food.id)} aria-label={`${t("删除")}${getLocalizedFoodField(food, "name", language)}`}><Trash2 size={15} /></button>
                </div>
                <h3>{getLocalizedFoodField(food, "name", language)}</h3>
                <p>{food.brand ? getLocalizedFoodField(food, "brand", language) : t("AI 估算")} · {getLocalizedFoodField(food, "portionLabel", language)}</p>
                <MealMacroGrid food={food} />
                {getFoodHealthTip(food) ? <p className="meal-entry__tip"><Sparkles size={14} /> {t(getFoodHealthTip(food) ?? "")}</p> : null}
                <button type="button" className="meal-entry__save" onClick={() => onSaveFood(food.id)}><Check size={16} /> {t("计入今天")}</button>
              </article>
            ))}
            {savedFoods.map((food) => (
              <article key={food.id} className="meal-entry meal-entry--saved">
                <div className="meal-entry__top"><span><Check size={13} /> {t("已记录")}</span></div>
                <h3>{getLocalizedFoodField(food, "name", language)}</h3>
                <p>{food.brand ? getLocalizedFoodField(food, "brand", language) : t("日常饮食")} · {getLocalizedFoodField(food, "portionLabel", language)}</p>
                <MealMacroGrid food={food} />
                {getFoodHealthTip(food) ? <p className="meal-entry__tip"><Sparkles size={14} /> {t(getFoodHealthTip(food) ?? "")}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="experience-section nutrition-story">
        <div className="section-heading">
          <div>
            <span className="experience-kicker">Live nutrition dashboard</span>
            <h2>{t("今日营养进度")}</h2>
          </div>
          <button type="button" className="text-action" onClick={() => onNavigate("calendar")}>
            {t("查看完整进度")} <ChevronRight size={17} />
          </button>
        </div>

        <div className="nutrition-dashboard">
          <section className="attainment-card" aria-label={t("今日营养达标率")}>
            <NutritionOrbit percent={overallProgress} />
            <div className="attainment-card__copy">
              <span className="experience-kicker">Daily attainment</span>
              <h3>{t("今日营养达标率")}</h3>
              <p>{t(goalLabels[profile.goal])}{t("目标")} · BMR {bmr} kcal · {t(dietStatusLabels[day.dietStatus].label)}</p>
              <div className="attainment-card__facts">
                <span><strong>{savedFoods.length}</strong> {t("已计入食物")}</span>
                <span><strong>{Math.max(0, Math.round(gaps.calories))}</strong> kcal {t("余量")}</span>
              </div>
              <div className="mode-switch" aria-label={t("今日模式")}>
                <button type="button" aria-pressed={day.isTrainingDay} onClick={() => onDayChange({ ...day, isTrainingDay: true })} className={day.isTrainingDay ? "is-active" : ""}>{t("训练日")}</button>
                <button type="button" aria-pressed={!day.isTrainingDay} onClick={() => onDayChange({ ...day, isTrainingDay: false })} className={!day.isTrainingDay ? "is-active" : ""}>{t("恢复日")}</button>
              </div>
            </div>
          </section>

          <section className="nutrient-lanes" aria-label={t("选择营养指标")}>
            {macroKeys.map((macro) => (
              <button
                key={macro}
                type="button"
                className={`nutrient-lane ${selectedMacro === macro ? "is-active" : ""}`}
                aria-pressed={selectedMacro === macro}
                onClick={() => setSelectedMacro(macro)}
              >
                <span className="nutrient-lane__ring" style={{ background: `conic-gradient(${ringTone[macro]} ${Math.min(completion(animatedTotals[macro], targets[macro]), 100)}%, rgba(29,42,34,.08) 0)` }}>
                  <i>{completion(animatedTotals[macro], targets[macro])}%</i>
                </span>
                <span className="nutrient-lane__copy">
                  <strong>{t(macroLabels[macro].label)}</strong>
                  <small>{Math.round(animatedTotals[macro])} / {Math.round(targets[macro])}{macroLabels[macro].unit}</small>
                </span>
                <span className="nutrient-lane__bar" aria-hidden="true"><i style={{ width: `${Math.min(completion(animatedTotals[macro], targets[macro]), 100)}%`, background: ringTone[macro] }} /></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
          </section>

          <section className="nutrient-focus" aria-live="polite">
            <div className="nutrient-focus__heading">
              <span>{t("当前查看")}</span>
              <strong>{t(macroLabels[selectedMacro].label)}</strong>
            </div>
            <div className="nutrient-focus__metric">
              <strong>{Math.round(animatedTotals[selectedMacro])}<small>{macroLabels[selectedMacro].unit}</small></strong>
              <span>{t("目标")} {Math.round(targets[selectedMacro])}{macroLabels[selectedMacro].unit}</span>
            </div>
            <div className="nutrient-focus__status">
              <span>{t(getMacroStatus(selectedMacroPercent))}</span>
              <strong>{selectedMacroGap > 0 ? t("还差 {count}{unit}", { count: Math.round(selectedMacroGap), unit: macroLabels[selectedMacro].unit }) : t("今日目标已达到")}</strong>
            </div>
            <div className="nutrient-contributors">
              <span>{t("主要食物贡献")}</span>
              {selectedContributors.length ? selectedContributors.map((food) => (
                <div key={food.id}>
                  <strong>{getLocalizedFoodField(food, "name", language)}</strong>
                  <span>{Math.round(food.macros[selectedMacro])}{macroLabels[selectedMacro].unit}</span>
                </div>
              )) : <p>{t("计入食物后，这里会显示贡献最大的来源。")}</p>}
            </div>
          </section>
        </div>
      </section>
      </section>

      <section className="next-bite-feature">
        <img src="/images/recommendation-rail-v2.png" alt={t("三种适合作为下一餐的健康食物")} />
        <div className="next-bite-feature__overlay" />
        <div className="next-bite-feature__content">
          <span className="experience-kicker experience-kicker--light"><Flame size={14} /> Smart recommendation</span>
          <h2>{t("智能推荐下一餐")}</h2>
          <p>{t("根据当前营养缺口、训练状态和已有记录生成推荐方案。")}</p>
          <div className="gap-summary">
            <span>{t("蛋白还差")} <strong>{Math.max(0, Math.round(gaps.protein))}g</strong></span>
            <span>{t("热量余量")} <strong>{Math.max(0, Math.round(gaps.calories))} kcal</strong></span>
          </div>
          <button type="button" onClick={() => onNavigate("recommend")} className="feature-cta">{t("看看下一餐")} <ArrowRight size={18} /></button>
        </div>
      </section>
    </div>
  );
}

function NutritionOrbit({ percent }: { percent: number }) {
  const { t } = useI18n();
  return (
    <div className="master-orbit" style={{ background: `conic-gradient(#f2ce67 ${Math.min(percent, 100)}%, rgba(255,255,255,.16) 0)` }}>
      <div><strong>{percent}%</strong><span>{t("营养达标率")}</span></div>
    </div>
  );
}

function getMacroStatus(percent: number) {
  if (percent >= 100) return "已达到目标";
  if (percent >= 70) return "接近今日目标";
  if (percent >= 35) return "正在稳步补充";
  return "今天还可以继续补充";
}

function MealMacroGrid({ food }: { food: FoodLogItem }) {
  const { t, language } = useI18n();
  return (
    <div className="meal-entry__macros" aria-label={`${getLocalizedFoodField(food, "name", language)} ${t("的营养含量")}`}>
      {macroKeys.map((macro) => (
        <span key={macro}>
          <strong>{Math.round(food.macros[macro])}{macroLabels[macro].unit}</strong>
          {t(macroLabels[macro].short)}
        </span>
      ))}
    </div>
  );
}

function getFoodHealthTip(food: FoodLogItem) {
  const details = `${food.name} ${food.foodType} ${food.warning ?? ""}`;

  if (/奶茶|可乐|含糖|甜饮|果茶|糖浆/.test(details)) return "饮料换成无糖版本，减少额外糖分";
  if (/炸|酥|鸡皮|油碟|烧烤|烤肉|重油/.test(details) || food.macros.fat >= 28) return "去皮少油，再搭配一份蔬菜";
  if (/米饭|盖饭|炒饭|面|粉/.test(details) && food.macros.fiber < 5) return "部分精制主食换成杂粮或薯类";
  if (food.macros.calories >= 450 && food.macros.fiber < 5) return "补一份蔬菜，提高这一餐的纤维";
  if (food.warning && /少油|无糖|换成|搭配|补一份|减少|控制/.test(food.warning)) return food.warning;
  return null;
}

const emptyMacroTotals: MacroTotals = { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 };

function useAnimatedMacroTotals(target: MacroTotals) {
  const [displayed, setDisplayed] = useState<MacroTotals>(emptyMacroTotals);
  const displayedRef = useRef<MacroTotals>(emptyMacroTotals);

  useEffect(() => {
    const from = displayedRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 1 : 1500;
    const startedAt = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = macroKeys.reduce((values, macro) => {
        values[macro] = from[macro] + (target[macro] - from[macro]) * eased;
        return values;
      }, { ...emptyMacroTotals });
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return displayed;
}

type FoodAiResult = {
  ok?: boolean;
  isFoodRelated?: boolean;
  message?: string;
  needsConfig?: boolean;
  foods?: FoodLogItem[];
};

async function requestFoodAi(form: FormData, language: Language): Promise<{ ok: boolean; retryable: boolean; message?: string; result?: FoodAiResult }> {
  try {
    const response = await fetch("/api/food-ai", { method: "POST", body: form });
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    let result: FoodAiResult;
    try {
      result = await response.json();
    } catch {
      return { ok: false, retryable, message: retryable ? pick(language, "AI 服务响应太慢或暂时不可用。", "The AI service is slow or temporarily unavailable.") : pick(language, "AI 返回内容无法读取。", "The AI response could not be read.") };
    }
    if (!response.ok || !result.ok) {
      return { ok: false, retryable: !result.needsConfig && retryable, message: result.message || pick(language, "AI 这次没有识别成功。", "The AI couldn't recognize it this time."), result };
    }
    return { ok: true, retryable: false, result };
  } catch {
    return { ok: false, retryable: true, message: pick(language, "AI 服务连接失败。", "The AI service connection failed.") };
  }
}

function withRetryHint(message: string, language: Language) {
  const trimmed = message.trim().replace(/[。,.，\s]+$/, "");
  if (!trimmed) return pick(language, "AI 这次没接住（请再试一次）", "The AI missed that. (Please try again)");
  const suffix = pick(language, "（请再试一次）", " (try again)");
  if (language === "zh" && trimmed.endsWith("（请再试一次）")) return trimmed;
  if (language === "en" && trimmed.toLowerCase().endsWith("(try again)")) return trimmed;
  return `${trimmed}${suffix}`;
}
