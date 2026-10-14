"use client";

import type { UserProfile, DayState, MacroTotals, FoodLogItem, MacroKey } from "@/shared/domain/types";
import { useI18n } from "@/shared/i18n/i18n";
import { useState, useEffect } from "react";
import { useRecognitionProgress } from "@/features/recognition/ui/use-recognition-progress";
import { weightedScore, formatScorePercent } from "@/shared/domain/score";
import { requestFoodAi } from "@/features/recognition/ui/recognition-client";
import { useRoutePreview } from "@/features/recognition/ui/use-route-preview";
import { pick, type Language } from "@/shared/i18n/i18n-utils";
import { MessageSquareText, Loader2, ScanLine, ArrowRight, Trash2, Utensils, Sparkles, Check, ChevronRight } from "lucide-react";
import { RecognitionProgress } from "@/features/recognition/ui/RecognitionProgress";
import { getLocalizedFoodField } from "@/shared/i18n/translations";
import { macroKeys, completion } from "@/shared/domain/nutrition";
import { macroLabels } from "@/shared/domain/labels";
import { useAnimatedMacroTotals } from "@/features/daily-log/ui/use-animated-macro-totals";
import { MealMacroGrid, getFoodHealthTip } from "@/features/daily-log/ui/MealMacroGrid";

type DashboardProps = {
  presentation?: "legacy" | "workspace";
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
  /** Cloud mode: server-computed weighted score (0..1) and confirmed recognition count for today. */
  score?: number | null;
  busyFoodIds?: string[];
  /** Confirmed entries may be deleted until the Beijing day ends (cloud mode only). */
  allowDeleteSaved?: boolean;
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
  presentation = "legacy",
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
  onClearDrafts,
  score,
  busyFoodIds = [],
  allowDeleteSaved = false
}: DashboardProps) {
  const { t, language } = useI18n();
  const [mealDescription, setMealDescription] = useState("");
  const routeHintFor = useRoutePreview(mealDescription);
  const [recognitionNotice, setRecognitionNotice] = useState<RecognitionNoticeState | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const progress = useRecognitionProgress();
  // Sources belong to the latest recognition only, never to every food logged today.
  const [lastRecognizedFoods, setLastRecognizedFoods] = useState<FoodLogItem[]>([]);
  const draftFoods = foods.filter((food) => !food.savedToCalendar);
  const savedFoods = foods.filter((food) => food.savedToCalendar);
  const animatedTotals = useAnimatedMacroTotals(totals);
  const scoreFraction = score ?? weightedScore(totals, targets);
  const scoreText = formatScorePercent(scoreFraction);
  const overallProgress = Math.min(100, scoreFraction * 100);

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
    if (isRecognizing) return;
    const description = mealDescription.trim();
    if (!description) {
      setRecognitionNotice({ key: "先告诉我你吃了什么，品牌、份量和配菜越具体越好。" });
      return;
    }

    const form = new FormData();
    form.append("description", description);
    form.append("lang", language);
    const requestProgress = progress.begin();
    setLastRecognizedFoods([]);
    setIsRecognizing(true);
    setRecognitionNotice({ key: "AI 正在拆解食材、份量和营养结构…" });

    try {
      const routeHint = await routeHintFor(description);
      if (routeHint) {
        form.append("routeHint", routeHint.route);
        form.append("routeHintConfidence", String(routeHint.confidence));
      }
      const aiResult = await requestFoodAi(form, language, requestProgress);
      if (!aiResult.ok || !aiResult.result?.ok) {
        setRecognitionNotice({ text: withRetryHint(aiResult.message || aiResult.result?.message || t("AI 这次没算准。"), language) });
        return;
      }
      const recognizedFoods = aiResult.result.foods ?? [];
      if (!aiResult.result.isFoodRelated || !recognizedFoods.length) {
        setRecognitionNotice({ key: "这段描述里没有识别到明确食物，请补充菜名或份量。" });
        return;
      }
      setLastRecognizedFoods(recognizedFoods);
      onAddFoods(recognizedFoods);
      setMealDescription("");
      setRecognitionNotice({ text: pick(language,
        `识别完成：${recognizedFoods.length} 个食物已进入待确认记录，确认后计入今日营养进度。`,
        `Recognized ${recognizedFoods.length} foods. Confirm them in today's food records to update your nutrition progress.`
      ) });
    } catch {
      setRecognitionNotice({ text: withRetryHint(t("AI 连接暂时没有响应。"), language) });
    } finally {
      setIsRecognizing(false);
    }
  }

  const recognitionPanel = (
    <section className="food-hero">
        <img
          src={presentation === "workspace" ? "/images/nutrition-garden.jpg" : "/images/wellness-hero-v2.png"}
          alt={presentation === "workspace" ? "" : t("摆放着三文鱼、牛油果、蔬菜和谷物的均衡餐")}
          aria-hidden={presentation === "workspace" ? true : undefined}
          className="food-hero__image"
        />
        <div className="food-hero__veil" />
        <div className="food-hero__content">
          <div className="flex flex-wrap items-center gap-2">
            <span className="experience-kicker experience-kicker--light">AI Nutrition</span>
            <span className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
              {todayLabel}
            </span>
          </div>
          <h1>{t("记录生活，")}<br />{t("看懂每一餐。")}</h1>
          <p>{t("输入食物、品牌和份量，AI 会识别食材并估算这一餐的营养。")}</p>

          <div className="food-composer" aria-busy={isRecognizing}>
            <div className="food-composer__field">
              <MessageSquareText size={20} aria-hidden="true" />
              <textarea
                value={mealDescription}
                disabled={isRecognizing}
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
              <button key={example} type="button" disabled={isRecognizing} onClick={() => setMealDescription(example)}>{t(example)}</button>
            ))}
          </div>
          <RecognitionProgress steps={progress.steps} running={isRecognizing} foods={lastRecognizedFoods} />
          {recognitionNotice && !isRecognizing ? <div className="recognition-toast">{"key" in recognitionNotice ? t(recognitionNotice.key, recognitionNotice.vars) : recognitionNotice.text}</div> : null}
        </div>
      </section>
  );
  const journalPanel = (
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
                  <button type="button" disabled={busyFoodIds.includes(food.id)} onClick={() => onRemoveFood(food.id)} aria-label={`${t("删除")}${getLocalizedFoodField(food, "name", language)}`}><Trash2 size={15} /></button>
                </div>
                <h3>{getLocalizedFoodField(food, "name", language)}</h3>
                <p>{food.brand ? getLocalizedFoodField(food, "brand", language) : t("AI 估算")} · {getLocalizedFoodField(food, "portionLabel", language)}</p>
                <MealMacroGrid food={food} />
                {getFoodHealthTip(food) ? <p className="meal-entry__tip"><Sparkles size={14} /> {t(getFoodHealthTip(food) ?? "")}</p> : null}
                <button type="button" className="meal-entry__save" disabled={busyFoodIds.includes(food.id)} onClick={() => onSaveFood(food.id)}><Check size={16} /> {busyFoodIds.includes(food.id) ? pick(language, "保存中…", "Saving…") : t("计入今天")}</button>
              </article>
            ))}
            {savedFoods.map((food) => (
              <article key={food.id} className="meal-entry meal-entry--saved">
                <div className="meal-entry__top">
                  <span><Check size={13} /> {t("已记录")}</span>
                  {allowDeleteSaved ? <button type="button" disabled={busyFoodIds.includes(food.id)} onClick={() => onRemoveFood(food.id)} aria-label={`${t("删除")}${getLocalizedFoodField(food, "name", language)}`}><Trash2 size={15} /></button> : null}
                </div>
                <h3>{getLocalizedFoodField(food, "name", language)}</h3>
                <p>{food.brand ? getLocalizedFoodField(food, "brand", language) : t("日常饮食")} · {getLocalizedFoodField(food, "portionLabel", language)}</p>
                <MealMacroGrid food={food} />
                {getFoodHealthTip(food) ? <p className="meal-entry__tip"><Sparkles size={14} /> {t(getFoodHealthTip(food) ?? "")}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
  );
  const nutritionPanel = (
    <section id={presentation === "legacy" ? undefined : "overview"} className="experience-section nutrition-story">
        <div className="section-heading">
          <div>
            <h2>{t("今日营养进度")}</h2>
          </div>
          <button type="button" className="text-action" onClick={() => onNavigate("calendar")}>
            {t("查看完整进度")} <ChevronRight size={17} />
          </button>
        </div>

        <div className="nutrition-dashboard nutrition-dashboard--report">
          <section className="nutrition-summary" aria-label={t("今日营养达标率")}>
            <div className="nutrition-summary__header">
              <h3>{pick(language, "今日达标", "Daily progress")}</h3>
              <div className="nutrition-day-switch" aria-label={t("今日模式")}>
                <button type="button" aria-pressed={day.isTrainingDay} onClick={() => onDayChange({ ...day, isTrainingDay: true })}>{t("训练日")}</button>
                <button type="button" aria-pressed={!day.isTrainingDay} onClick={() => onDayChange({ ...day, isTrainingDay: false })}>{t("恢复日")}</button>
              </div>
            </div>
            <div className="nutrition-summary__numbers">
              <div className="nutrition-summary__attainment">
                <strong>{scoreText}<span>%</span></strong>
                <span>{pick(language, "综合营养达标率", "Overall nutrient progress")}</span>
              </div>
              <div className="nutrition-summary__energy">
                <span>{pick(language, "已摄入热量", "Calories logged")}</span>
                <strong>{Math.round(animatedTotals.calories)}<small> kcal</small></strong>
                <span>{pick(language, "每日目标", "Daily target")} {Math.round(targets.calories)} kcal</span>
              </div>
            </div>
            <div className="nutrition-summary__track" role="progressbar" aria-label={t("今日营养达标率")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(scoreText)}>
              <i style={{ width: `${overallProgress}%` }} />
            </div>
            <div className="nutrition-summary__balance">
              <span>{pick(language, "已计入", "Logged")} <strong>{savedFoods.length}</strong> {pick(language, "项食物", "foods")}</span>
              <span>{gaps.calories < 0 ? pick(language, "超出目标", "Over target") : pick(language, "剩余", "Remaining")} <strong>{Math.round(Math.abs(gaps.calories))}</strong> kcal</span>
            </div>
          </section>

          <section className="nutrition-metrics" aria-label={pick(language, "营养指标进度", "Nutrient progress")}>
            {macroKeys.map((macro) => (
              <div key={macro} className="nutrition-metric">
                <div className="nutrition-metric__heading">
                  <span className="nutrition-metric__name"><i style={{ background: ringTone[macro] }} />{t(macroLabels[macro].label)}</span>
                  <span className="nutrition-metric__amount"><strong>{Math.round(animatedTotals[macro])}</strong><span> / {Math.round(targets[macro])} {macroLabels[macro].unit}</span></span>
                </div>
                <div className="nutrition-metric__track" role="progressbar" aria-label={t(macroLabels[macro].label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(completion(animatedTotals[macro], targets[macro]), 100)} aria-valuetext={`${Math.round(animatedTotals[macro])} / ${Math.round(targets[macro])} ${macroLabels[macro].unit}`}>
                  <i style={{ width: `${Math.min(completion(animatedTotals[macro], targets[macro]), 100)}%`, background: ringTone[macro] }} />
                </div>
              </div>
            ))}
          </section>
        </div>
      </section>
  );

  return (
    <div className="nutrition-experience">
      <section className="nutrition-console" aria-label={t("AI 饮食识别与营养进度")}>
        {presentation === "workspace" ? (
          <section id="recognition" role="region" aria-labelledby="tab-recognition" className="preview-recognition">
            {recognitionPanel}
            {journalPanel}
            {nutritionPanel}
          </section>
        ) : <>{recognitionPanel}{journalPanel}{nutritionPanel}</>}
      </section>
      <section className="next-bite-feature">
        <img src="/images/recommendation-rail-v2.png" alt={t("三种适合作为下一餐的健康食物")} />
        <div className="next-bite-feature__overlay" />
        <div className="next-bite-feature__content">
          <span className="experience-kicker experience-kicker--light">Smart recommendation</span>
          <h2>{t("智能推荐下一餐")}</h2>
          <p>{t("根据当前营养缺口、训练状态和已有记录生成推荐方案。")}</p>
          <button type="button" onClick={() => onNavigate("recommend")} className="feature-cta">{t("看看下一餐")} <ArrowRight size={18} /></button>
        </div>
      </section>
    </div>
  );
}

function withRetryHint(message: string, language: Language) {
  const trimmed = message.trim().replace(/[。,.，\s]+$/, "");
  if (!trimmed) return pick(language, "AI 这次没接住（请再试一次）", "The AI missed that. (Please try again)");
  const suffix = pick(language, "（请再试一次）", " (try again)");
  if (language === "zh" && trimmed.endsWith("（请再试一次）")) return trimmed;
  if (language === "en" && trimmed.toLowerCase().endsWith("(try again)")) return trimmed;
  return `${trimmed}${suffix}`;
}
