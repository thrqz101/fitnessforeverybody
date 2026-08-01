"use client";

import { Check, Dice5, Flame, Loader2, Sparkles, Utensils, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { catalogItemToRecommendation, foodCatalog, type FoodCatalogItem } from "@/lib/food-catalog";
import { addMacros, completion, dietStatusLabels, macroKeys, macroLabels, recommendationCoverage, scaleMacros } from "@/lib/nutrition";
import { recommendationToFood, recommendations } from "@/lib/mock-data";
import type { DayState, FoodLogItem, MacroTotals, Recommendation, UserProfile } from "@/lib/types";

const AI_RECOMMENDATION_COUNT = 30;

type RegionFilter = "all" | "chinese" | "western";
type MealSlotFilter = "all" | "breakfast" | "lunch_dinner" | "midnight" | "topup";
type StyleFilter =
  | "all"
  | "breakfast"
  | "stir_fry"
  | "hotpot"
  | "malatang"
  | "korean_bbq"
  | "japanese"
  | "skewer_bbq"
  | "steak"
  | "rice_noodle"
  | "fast_food"
  | "tea_coffee"
  | "convenience"
  | "light_meal"
  | "fruit_snack"
  | "supplement";

const regionFilters: Array<{ value: RegionFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "chinese", label: "中餐" },
  { value: "western", label: "西餐" }
];

const mealSlotFilters: Array<{ value: MealSlotFilter; label: string }> = [
  { value: "all", label: "全部餐别" },
  { value: "breakfast", label: "早餐" },
  { value: "lunch_dinner", label: "午餐 / 晚餐" },
  { value: "midnight", label: "夜宵" },
  { value: "topup", label: "轻补" }
];

const styleFilters: Array<{ value: StyleFilter; label: string; regions: RegionFilter[] }> = [
  { value: "all", label: "全部品类", regions: ["all", "chinese", "western"] },
  { value: "breakfast", label: "早餐早点", regions: ["all", "chinese"] },
  { value: "stir_fry", label: "家常菜 / 炒菜", regions: ["all", "chinese"] },
  { value: "hotpot", label: "火锅", regions: ["all", "chinese"] },
  { value: "malatang", label: "麻辣烫 / 冒菜", regions: ["all", "chinese"] },
  { value: "korean_bbq", label: "韩式烤肉", regions: ["all", "chinese"] },
  { value: "japanese", label: "日料", regions: ["all", "chinese"] },
  { value: "skewer_bbq", label: "烧烤 / 烤串", regions: ["all", "chinese"] },
  { value: "steak", label: "牛排", regions: ["all", "western"] },
  { value: "rice_noodle", label: "粉面 / 快餐", regions: ["all", "chinese"] },
  { value: "fast_food", label: "汉堡 / 西式快餐", regions: ["all", "western"] },
  { value: "tea_coffee", label: "奶茶 / 咖啡", regions: ["all", "chinese", "western"] },
  { value: "convenience", label: "便利店", regions: ["all", "chinese", "western"] },
  { value: "light_meal", label: "轻食", regions: ["all", "chinese", "western"] },
  { value: "fruit_snack", label: "水果零食", regions: ["all", "chinese", "western"] },
  { value: "supplement", label: "健身补剂", regions: ["all", "chinese", "western"] }
];

type RecommendationsProps = {
  profile: UserProfile;
  day: DayState;
  gaps: MacroTotals;
  targets: MacroTotals;
  totals: MacroTotals;
  foods: FoodLogItem[];
  onChoose: (food: FoodLogItem) => void;
  onRecognizeRequested: () => void;
};

export function Recommendations({ profile, day, gaps, targets, totals, foods, onChoose, onRecognizeRequested }: RecommendationsProps) {
  const [aiRecommendations, setAiRecommendations] = useState<Recommendation[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [mealSlotFilter, setMealSlotFilter] = useState<MealSlotFilter>("all");
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("all");
  const mainMealCount = useMemo(() => countMainMeals(foods), [foods]);
  const currentPercentages = useMemo(() => getCompletionSnapshot(totals, targets), [totals, targets]);
  const shouldLightOnly = currentPercentages.average >= 80;
  const availableStyleFilters = useMemo(() => styleFilters.filter((filter) => filter.regions.includes(regionFilter)), [regionFilter]);
  const combinedRecommendations = useMemo(() => uniqueRecommendations([...aiRecommendations, ...recommendations]), [aiRecommendations]);
  const candidatePool = useMemo(
    () => (shouldLightOnly ? combinedRecommendations.filter(isLightRecommendation) : combinedRecommendations),
    [combinedRecommendations, shouldLightOnly]
  );
  const ranked = useMemo(
    () => [...candidatePool].sort((a, b) => rankRecommendation(b, gaps, profile, day, shouldLightOnly) - rankRecommendation(a, gaps, profile, day, shouldLightOnly)),
    [candidatePool, day, gaps, profile, shouldLightOnly]
  );
  const filteredRanked = useMemo(
    () => ranked.filter((recommendation) => matchesRecommendationFilters(recommendation, regionFilter, mealSlotFilter, styleFilter)),
    [ranked, regionFilter, mealSlotFilter, styleFilter]
  );
  const bottomShufflePool = useMemo(() => buildBottomFoodShufflePool(aiRecommendations), [aiRecommendations]);
  const shufflePool = useMemo(
    () => bottomShufflePool
      .filter((recommendation) => !shouldLightOnly || isLightRecommendation(recommendation))
      .filter((recommendation) => matchesRecommendationFilters(recommendation, regionFilter, mealSlotFilter, styleFilter)),
    [bottomShufflePool, mealSlotFilter, regionFilter, shouldLightOnly, styleFilter]
  );
  const [picked, setPicked] = useState<Recommendation | null>(null);
  const [shuffleOpen, setShuffleOpen] = useState(false);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [shuffleRunId, setShuffleRunId] = useState(0);
  const [shuffleDone, setShuffleDone] = useState(false);
  const recentShuffleIdsRef = useRef<string[]>([]);
  const shuffleCandidate = shufflePool[shuffleIndex % Math.max(shufflePool.length, 1)];
  const shuffleCompletion = shuffleCandidate ? getCompletionSnapshot(addMacros(totals, shuffleCandidate.macros), targets) : currentPercentages;

  useEffect(() => {
    if (!availableStyleFilters.some((filter) => filter.value === styleFilter)) {
      setStyleFilter("all");
    }
  }, [availableStyleFilters, styleFilter]);

  useEffect(() => {
    if (!filteredRanked.length) {
      setPicked(null);
      return;
    }

    const pickedStillAvailable =
      picked &&
      (filteredRanked.some((recommendation) => recommendation.id === picked.id) ||
        shufflePool.some((recommendation) => recommendation.id === picked.id));

    if (!pickedStillAvailable) {
      setPicked(filteredRanked[0]);
    }
  }, [filteredRanked, picked, shufflePool]);

  useEffect(() => {
    if (!shuffleOpen || !shufflePool.length) return;

    setShuffleDone(false);
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setShuffleIndex((current) => (current + 1 + Math.floor(Math.random() * 11)) % shufflePool.length);
      if (ticks >= 18) {
        window.clearInterval(timer);
        const winner = pickStratifiedShuffleWinner(shufflePool, shuffleRunId, recentShuffleIdsRef.current);
        const winnerIndex = Math.max(0, shufflePool.findIndex((item) => item.id === winner.id));
        setShuffleIndex(winnerIndex);
        setPicked(winner);
        recentShuffleIdsRef.current = [winner.id, ...recentShuffleIdsRef.current.filter((id) => id !== winner.id)].slice(0, 18);
        setShuffleDone(true);
      }
    }, 90);

    return () => window.clearInterval(timer);
  }, [shuffleOpen, shufflePool, shuffleRunId]);

  useEffect(() => {
    if (!shuffleOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shuffleOpen]);

  function startShuffle() {
    if (!shufflePool.length) return;
    setShuffleDone(false);
    setShuffleIndex(Math.floor(Math.random() * shufflePool.length));
    setShuffleRunId((current) => current + 1);
    setShuffleOpen(true);
  }

  async function requestAiRecommendations() {
    setIsAiLoading(true);
    setAiNotice(`AI 正在从系统食物库里帮你补 ${AI_RECOMMENDATION_COUNT} 种候选...`);

    try {
      const response = await fetch("/api/recommend-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          day,
          gaps,
          targets,
          totals,
          mainMealCount,
          shouldLightOnly,
          desiredCount: AI_RECOMMENDATION_COUNT,
          existingOptions: (filteredRanked.length ? filteredRanked : ranked).slice(0, 50).map((item) => `${item.brand}：${item.title}`)
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setAiNotice(result.message || "AI 推荐暂时没有生成成功，先用本地推荐池。");
        return;
      }

      const next = (result.recommendations ?? []) as Recommendation[];
      setAiRecommendations((current) => uniqueRecommendations([...next, ...current]).slice(0, AI_RECOMMENDATION_COUNT));
      setAiNotice(next.length ? `AI 新增了 ${next.length} 个候选，已经混进推荐池。` : "AI 暂时没有给出新候选，先用本地推荐池。");
    } catch {
      setAiNotice("AI 推荐请求失败了，先用本地推荐池。");
    } finally {
      setIsAiLoading(false);
    }
  }

  return (
    <div className="recommend-experience">
      <section className="recommend-hero">
        <img src="/images/recommendation-rail-v2.png" alt="为今天推荐的三种均衡餐食" />
        <div className="recommend-hero__veil" />
        <div className="recommend-hero__content">
          <span className="experience-kicker experience-kicker--light"><Sparkles size={14} /> For your next bite</span>
          <h1><span>下一餐，</span><span>不靠猜。</span></h1>
          <p>{shouldLightOnly ? "当前营养完成度较高，优先推荐水果、酸奶或轻量加餐。" : "根据已有饮食记录、训练状态和营养缺口生成推荐。"}</p>
          <div className="recommend-hero__metrics">
            <div><span>今日完成</span><strong>{currentPercentages.average}%</strong></div>
            <div><span>蛋白缺口</span><strong>{Math.max(0, Math.round(gaps.protein))}g</strong></div>
            <div><span>已记录</span><strong>{mainMealCount} 餐</strong></div>
          </div>
          <div className="recommend-hero__actions">
            <button type="button" onClick={startShuffle}><Dice5 size={18} /> 帮我选一个</button>
            <button type="button" onClick={requestAiRecommendations} disabled={isAiLoading}>
              {isAiLoading ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />} AI 生成更多
            </button>
            <button type="button" onClick={onRecognizeRequested}>重新识别食物</button>
          </div>
          {aiNotice ? <p className="recommend-hero__notice">{aiNotice}</p> : null}
        </div>
      </section>

      {picked ? (
        <section className="picked-meal">
          <div><span><Flame size={15} /> 此刻最合适</span><h2>{picked.title}</h2><p>{picked.brand} · {dietStatusLabels[day.dietStatus].label}</p></div>
          <div className="picked-meal__macros">
            <span><strong>{Math.round(picked.macros.protein)}g</strong> 蛋白</span>
            <span><strong>{Math.round(picked.macros.calories)}</strong> kcal</span>
          </div>
          <button type="button" onClick={() => onChoose(recommendationToFood(picked))}><Check size={17} /> 就吃这个</button>
        </section>
      ) : null}

      <section className="recommendation-library">
        <div className="section-heading">
          <div><span className="experience-kicker">Curated for you</span><h2>推荐方案</h2></div>
          <p>{filteredRanked.length} 个匹配方案 · {shouldLightOnly ? "轻补模式" : "平衡正餐模式"}</p>
        </div>

        <div className="recommend-filters">
          <FilterGroup label="餐饮地域">
            {regionFilters.map((filter) => (
              <FilterButton
                key={filter.value}
                active={regionFilter === filter.value}
                onClick={() => setRegionFilter(filter.value)}
              >
                {filter.label}
              </FilterButton>
            ))}
          </FilterGroup>
          <FilterGroup label="餐别">
            {mealSlotFilters.map((filter) => (
              <FilterButton
                key={filter.value}
                active={mealSlotFilter === filter.value}
                onClick={() => setMealSlotFilter(filter.value)}
              >
                {filter.label}
              </FilterButton>
            ))}
          </FilterGroup>
          <FilterGroup label="品类">
            {availableStyleFilters.map((filter) => (
              <FilterButton
                key={filter.value}
                active={styleFilter === filter.value}
                onClick={() => setStyleFilter(filter.value)}
              >
                {filter.label}
              </FilterButton>
            ))}
          </FilterGroup>
        </div>

        <div className="recommendation-grid">
          {filteredRanked.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              targets={targets}
              totals={totals}
              selected={picked?.id === recommendation.id}
              onPick={() => setPicked(recommendation)}
              onChoose={() => onChoose(recommendationToFood(recommendation))}
            />
          ))}
        </div>
        {!filteredRanked.length ? (
          <div className="empty-recommendations">
            <p className="text-lg font-black text-ink">这个筛选组合暂时没有候选</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/55">可以放宽一个筛选项，或者点 AI 再推荐 30 种。</p>
          </div>
        ) : null}
      </section>

      {shuffleOpen && shuffleCandidate ? createPortal(
        <div className="shuffle-overlay">
          <section className={`shuffle-flashcard ${shuffleDone ? "is-complete" : "is-shuffling"}`} role="dialog" aria-modal="true" aria-label="随机推荐结果">
            <div className="shuffle-flashcard__header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Random Pick</p>
                <h2 className="mt-1 text-2xl font-black text-ink">随机推荐</h2>
              </div>
              <button
                type="button"
                onClick={() => setShuffleOpen(false)}
                aria-label="关闭随机推荐"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-ink/12 bg-paper text-ink"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="shuffle-flashcard__stage">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-moss">
                {shuffleDone ? "摇到了" : "正在为你翻牌"}
              </p>
              <h3 className="mt-3 text-3xl font-black leading-tight text-ink">{shuffleCandidate.title}</h3>
              <p className="mt-2 text-sm font-bold text-ink/58">{shuffleCandidate.brand}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {shuffleCandidate.items.map((item) => (
                  <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink/62">
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold text-ink/62">
                蛋白 {Math.round(shuffleCandidate.macros.protein)}g · 碳水 {Math.round(shuffleCandidate.macros.carbs)}g · 脂肪 {Math.round(shuffleCandidate.macros.fat)}g
              </p>
              {shuffleDone ? (
                <div className="mt-4 rounded-[18px] border border-white bg-white/80 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">吃完预计达成</p>
                  <p className="mt-1 text-3xl font-black text-ink">{shuffleCompletion.average}%</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {macroKeys.map((macro) => (
                      <div key={macro} className="rounded-[18px] bg-paper px-2 py-2">
                        <p className="text-[11px] font-bold text-ink/45">{macroLabels[macro].short}</p>
                        <p className="mt-1 text-sm font-black text-moss">{shuffleCompletion[macro]}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!shuffleDone}
                onClick={() => {
                  onChoose(recommendationToFood(shuffleCandidate));
                  setShuffleOpen(false);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-moss px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={17} aria-hidden="true" />
                就吃摇到的
              </button>
              <button
                type="button"
                onClick={startShuffle}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] border border-ink/12 bg-paper px-4 text-sm font-black text-ink"
              >
                <Dice5 size={17} aria-hidden="true" />
                再摇一次
              </button>
            </div>
          </section>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-2 sm:grid-cols-[88px_1fr] sm:items-start">
      <p className="pt-1 text-xs font-black uppercase tracking-[0.16em] text-moss">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-xs font-black transition ${
        active
          ? "border-moss bg-moss text-white shadow-soft"
          : "border-ink/10 bg-white text-ink/66 hover:border-moss/35 hover:text-moss"
      }`}
    >
      {children}
    </button>
  );
}

function RecommendationCard({
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
  const afterCompletion = getCompletionSnapshot(addMacros(totals, recommendation.macros), targets);
  const suggestedMeal = inferSuggestedMeal(recommendation);

  return (
    <article className={`recommendation-card border p-4 transition ${selected ? "border-coral bg-coral/10 shadow-soft" : "border-ink/10 bg-paper/75"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase tracking-[0.16em] text-moss">
            <span>{categoryLabels[recommendation.category]}</span>
            {suggestedMeal ? <span>{suggestedMeal}</span> : null}
          </p>
          <h3 className="mt-1 truncate text-xl font-black leading-tight text-ink">{recommendation.brand}</h3>
          <p className="mt-1 text-sm font-semibold leading-5 text-ink/58">{recommendation.title}</p>
        </div>
        <Utensils className="shrink-0 text-ink/35" size={22} aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {recommendation.items.map((item) => (
          <span key={item} className="rounded-full border border-ink/10 bg-white px-2.5 py-1 text-xs font-bold text-ink/68">
            {item}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["protein", "carbs", "fat"] as const).map((macro) => {
          const percent = afterCompletion[macro];
          const over = percent > 115;
          return (
            <div key={macro} className="rounded-[18px] bg-white p-3">
              <p className="text-xs text-ink/48">{macroLabels[macro].label}</p>
              <p className="mt-1 text-base font-black text-ink">
                {Math.round(recommendation.macros[macro])}{macroLabels[macro].unit}
              </p>
              <p className={`mt-1 text-xs font-bold ${over ? "text-coral" : "text-moss"}`}>{percent}%{over ? " ↑" : ""}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm leading-6 text-ink/62">{recommendation.note}</p>
      {recommendation.caution ? <p className="mt-2 text-sm font-semibold text-coral">{recommendation.caution}</p> : null}
      <div className="mt-3 rounded-[18px] border border-moss/12 bg-mint/45 px-3 py-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-moss">吃完预计达成</p>
        <p className="mt-1 text-sm font-black text-ink">平均 {afterCompletion.average}% · 热量 {afterCompletion.calories}% · 蛋白 {afterCompletion.protein}%</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPick}
          className="inline-flex h-10 items-center justify-center rounded-[18px] border border-ink/12 bg-white px-3 text-sm font-black text-ink"
        >
          先看这个
        </button>
        <button
          type="button"
          onClick={onChoose}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[18px] bg-moss px-3 text-sm font-black text-white"
        >
          <Check size={16} aria-hidden="true" />
          选择这个
        </button>
      </div>
    </article>
  );
}

function countMainMeals(foods: FoodLogItem[]) {
  const mainMeals = new Set(
    foods
      .filter((food) => ["breakfast", "lunch", "dinner"].includes(food.meal))
      .map((food) => food.meal)
  );
  return mainMeals.size;
}

function getCompletionSnapshot(totals: MacroTotals, targets: MacroTotals): MacroTotals & { average: number } {
  const values = macroKeys.reduce((snapshot, macro) => {
    snapshot[macro] = Math.min(140, completion(totals[macro], targets[macro]));
    return snapshot;
  }, {} as MacroTotals);
  return {
    ...values,
    average: Math.round((values.protein + values.carbs + values.fat + values.calories + values.fiber) / 5)
  };
}

function isLightRecommendation(recommendation: Recommendation) {
  if (recommendation.category === "meal") return false;
  const text = `${recommendation.title} ${recommendation.brand} ${recommendation.items.join(" ")}`;
  if (/夜宵正餐|大碗|米饭 1 碗|火锅套餐|烧烤大餐/.test(text)) return false;
  return recommendation.macros.calories <= 560;
}

function matchesRecommendationFilters(
  recommendation: Recommendation,
  regionFilter: RegionFilter,
  mealSlotFilter: MealSlotFilter,
  styleFilter: StyleFilter
) {
  return (
    matchesRegionFilter(recommendation, regionFilter) &&
    matchesMealSlotFilter(recommendation, mealSlotFilter) &&
    matchesStyleFilter(recommendation, styleFilter)
  );
}

function matchesRegionFilter(recommendation: Recommendation, filter: RegionFilter) {
  if (filter === "all") return true;
  const western = isWesternRecommendation(recommendation);
  const shared = isSupplementRecommendation(recommendation);
  return filter === "western" ? western || shared : !western || shared;
}

function matchesMealSlotFilter(recommendation: Recommendation, filter: MealSlotFilter) {
  if (filter === "all") return true;
  const text = getRecommendationText(recommendation);
  const isBreakfast = /早餐|早点|包子|馒头|胡辣汤|馄饨|云吞|煎饼|鸡蛋灌饼|小米粥|油条|肠粉|小笼包|热干面|豆浆/.test(text);
  const isTopUp = recommendation.category === "topup" || recommendation.category === "protein" || recommendation.category === "snack";

  if (filter === "breakfast") return isBreakfast;
  if (filter === "lunch_dinner") return recommendation.category === "meal" && !isBreakfast;
  if (filter === "midnight") return !isBreakfast && (recommendation.category === "meal" || isTopUp || /夜宵|晚上|晚间|酪蛋白|燕麦杯|牛肉粉/.test(text));
  if (filter === "topup") return isTopUp;
  return true;
}

function matchesStyleFilter(recommendation: Recommendation, filter: StyleFilter) {
  if (filter === "all") return true;
  const text = getRecommendationText(recommendation);

  if (filter === "breakfast") return /早餐|早点|包子|馒头|胡辣汤|馄饨|云吞|煎饼|鸡蛋灌饼|小米粥|油条|肠粉|小笼包|热干面|豆浆/.test(text);
  if (filter === "stir_fry") return /家常菜|自己做饭|炒菜|小炒|川菜|湘菜|粤菜|赣菜|江西|江浙|本帮|云贵|贵州|东北|西北|宫保|麻婆|鱼香|清蒸鱼|白切鸡|龙井虾仁|汽锅鸡|酸汤鱼|番茄炒蛋|西红柿炒鸡蛋|西兰花|青椒肉丝|土豆丝|家常豆腐|肉末茄子|虾仁滑蛋|虾仁炒蛋|香菇滑鸡|清蒸鲈鱼|蒜蓉青菜|土豆炖牛肉|冬瓜排骨汤|木耳炒鸡蛋|白菜豆腐|番茄牛腩|西红柿牛腩|芹菜炒牛肉|胡萝卜鸡丁/.test(text);
  if (filter === "hotpot") return /火锅|海底捞|巴奴|呷哺|番茄锅|清汤锅|毛肚|虾滑|肥牛/.test(text);
  if (filter === "malatang") return /麻辣烫|冒菜|杨国福|张亮|宽粉|豆腐皮/.test(text);
  if (filter === "korean_bbq") return /韩式烤肉|烤肉店|瘦牛肉|生菜包|泡菜|五花肉/.test(text);
  if (filter === "japanese") return /日料|寿司|刺身|三文鱼|鳗鱼饭|照烧|荞麦面|味增汤|天妇罗|亲子丼/.test(text);
  if (filter === "skewer_bbq") return /烧烤|烤串|羊肉串|牛肉串|鸡翅|烤韭菜|烤蘑菇/.test(text);
  if (filter === "steak") return /牛排|西冷|肉眼|菲力|肋眼|沙朗|战斧|sirloin|ribeye|filet/.test(text);
  if (filter === "rice_noodle") return /粉面|面馆|拉面|牛肉面|汤面|拌面|热干面|螺蛳粉|米粉|河粉|馄饨|云吞|饺子|盖浇饭|盖饭|牛肉饭|鸡腿饭|猪脚饭|烧腊饭|黄焖鸡|沙县|兰州|快餐饭|卤味饭|饭团/.test(text);
  if (filter === "fast_food") return /快餐|汉堡|麦当劳|肯德基|汉堡王|塔斯汀|德克士|必胜客|赛百味|披萨|三明治|薯条|鸡块/.test(text);
  if (filter === "tea_coffee") return /奶茶|茶饮|咖啡|拿铁|瑞幸|星巴克|喜茶|奈雪|霸王茶姬|蜜雪冰城|古茗|茶百道|柠檬水|水果茶/.test(text);
  if (filter === "convenience") return /便利店|全家|罗森|711|关东煮|饭团|鸡胸肉肠|蔬菜杯|即食/.test(text);
  if (filter === "light_meal") return /轻食|沙拉|波奇|poke|寿司|三文鱼|酸奶|奶酪|燕麦/.test(text);
  if (filter === "fruit_snack") return /水果|香蕉|苹果|橙子|蓝莓|小番茄|黄瓜|红薯|坚果|牛肉干|猪肉脯|毛豆|零食/.test(text);
  if (filter === "supplement") return /蛋白粉|酪蛋白|蛋白棒|健身补剂|乳清/.test(text);
  return true;
}

function isWesternRecommendation(recommendation: Recommendation) {
  return /麦当劳|肯德基|汉堡王|德克士|必胜客|赛百味|星巴克|瑞幸|披萨|汉堡|三明治|沙拉|波奇|poke|拿铁|咖啡|牛排|西冷|肉眼|菲力|肋眼|沙朗|战斧|pizza|subway|steak|sirloin|ribeye|filet/.test(getRecommendationText(recommendation));
}

function isSupplementRecommendation(recommendation: Recommendation) {
  return /蛋白粉|酪蛋白|蛋白棒|健身补剂|乳清|whey/.test(getRecommendationText(recommendation));
}

function inferSuggestedMeal(recommendation: Recommendation) {
  const text = getRecommendationText(recommendation);

  if (/早餐|包子|馒头|胡辣汤|馄饨|云吞|煎饼|鸡蛋灌饼|小米粥|油条|肠粉|小笼包|热干面|豆浆/.test(text)) {
    return "推荐早饭";
  }

  if (/夜宵|晚上|晚间|酪蛋白|燕麦杯|牛肉粉/.test(text)) {
    return "推荐夜宵";
  }

  if (recommendation.category === "meal") {
    return "推荐午饭 / 晚饭 / 夜宵";
  }

  if (recommendation.category === "snack" || recommendation.category === "topup" || recommendation.category === "protein") {
    return "推荐轻补 / 夜宵";
  }

  return "";
}

function getRecommendationText(recommendation: Recommendation) {
  return `${recommendation.title} ${recommendation.brand} ${recommendation.items.join(" ")}`;
}

function rankRecommendation(recommendation: Recommendation, gaps: MacroTotals, profile: UserProfile, day: DayState, shouldLightOnly: boolean) {
  const base = recommendationCoverage(recommendation, gaps, profile, day);
  if (shouldLightOnly) return base + (recommendation.category === "meal" ? -2 : 0);
  return base + (recommendation.category === "meal" ? 0.45 : -0.08);
}

function uniqueRecommendations(items: Recommendation[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${normalizeForKey(item.brand)}::${normalizeForKey(item.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeForKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[+＋/／｜|，,、：:（）()]/g, "");
}

const shuffleBucketOrder: Exclude<StyleFilter, "all">[] = [
  "breakfast",
  "stir_fry",
  "hotpot",
  "malatang",
  "korean_bbq",
  "japanese",
  "skewer_bbq",
  "steak",
  "rice_noodle",
  "fast_food",
  "tea_coffee",
  "convenience",
  "light_meal",
  "fruit_snack",
  "supplement"
];

function buildBottomFoodShufflePool(aiItems: Recommendation[]) {
  return uniqueRecommendations([
    ...aiItems,
    ...foodCatalog.flatMap((item) => buildCatalogShuffleVariants(item))
  ]);
}

function buildCatalogShuffleVariants(item: FoodCatalogItem) {
  const base = {
    ...catalogItemToRecommendation(item),
    id: `shuffle-${item.id}`,
    note: `${item.note}（从底层食物库抽样，份量可按饥饿程度微调。）`
  };
  const variants: Recommendation[] = [base];

  if (item.category === "meal") {
    const smallMealSuffix = /早餐|早点|包子|馒头|胡辣汤|馄饨|云吞|煎饼|鸡蛋灌饼|小米粥|油条|肠粉|小笼包|热干面|豆浆/.test(getRecommendationText(base))
      ? "小份早餐"
      : "小份夜宵";
    variants.push(makeCatalogShuffleVariant(base, smallMealSuffix, 0.72, `按${smallMealSuffix}估算`));
    variants.push(makeCatalogShuffleVariant(base, "训练日加量", 1.12, "按训练日加量估算"));
  }

  if (item.category === "topup" || item.category === "snack" || item.category === "protein") {
    variants.push(makeCatalogShuffleVariant(base, "轻补小份", 0.82, "按轻补小份估算"));
  }

  if (item.items.length >= 4) {
    variants.push({
      ...base,
      id: `${base.id}-combo-${normalizeForKey(item.items.slice(0, 3).join(""))}`,
      title: `${item.title}（${item.items.slice(0, 3).join(" + ")}）`,
      items: item.items.slice(0, 4),
      macros: scaleMacros(item.macros, 0.88),
      note: `${item.foodType}里的具体组合抽样，按前几项主菜和配菜估算。`
    });
  }

  if (/火锅|麻辣烫|冒菜|烤肉|烧烤|牛排|日料|炒菜|盖饭|粉|面/.test(`${item.foodType} ${item.title}`)) {
    variants.push(makeCatalogShuffleVariant(base, "换个配菜组合", 0.95, "同品类换配菜估算"));
  }

  return variants;
}

function makeCatalogShuffleVariant(item: Recommendation, suffix: string, scale: number, itemSuffix: string): Recommendation {
  return {
    ...item,
    id: `${item.id}-${normalizeForKey(suffix)}`,
    title: `${item.title}（${suffix}）`,
    items: [...item.items.slice(0, 7), itemSuffix],
    macros: scaleMacros(item.macros, scale),
    note: `${item.note} 摇一摇按${suffix}估算，实际可以按饥饿程度微调。`
  };
}

function pickStratifiedShuffleWinner(items: Recommendation[], runId: number, recentIds: string[]) {
  const groups = shuffleBucketOrder
    .map((bucket) => items.filter((item) => getShuffleBucket(item) === bucket))
    .filter((group) => group.length > 0);

  if (!groups.length) return items[0];

  const startIndex = runId % groups.length;
  for (let offset = 0; offset < groups.length; offset += 1) {
    const group = groups[(startIndex + offset) % groups.length];
    const freshItems = group.filter((item) => !recentIds.includes(item.id));
    const pickable = freshItems.length ? freshItems : group;
    if (pickable.length) return pickable[Math.floor(Math.random() * pickable.length)];
  }

  return items[Math.floor(Math.random() * items.length)];
}

function getShuffleBucket(recommendation: Recommendation): Exclude<StyleFilter, "all"> {
  return shuffleBucketOrder.find((bucket) => matchesStyleFilter(recommendation, bucket)) ?? "light_meal";
}

const categoryLabels: Record<Recommendation["category"], string> = {
  meal: "正餐方案",
  topup: "轻加餐",
  protein: "健身补剂",
  snack: "零食 / 夜宵"
};
