"use client";

import type { UserProfile, DayState, MacroTotals, FoodLogItem, Recommendation } from "@/shared/domain/types";
import { useI18n } from "@/shared/i18n/i18n";
import { useState, useEffect, useMemo, useRef } from "react";
import { recommendations, recommendationToFood } from "@/features/recommendation/domain/preset-recommendations";
import { addMacros, macroKeys } from "@/shared/domain/nutrition";
import { dietStatusLabels, macroLabels } from "@/shared/domain/labels";
import { Sparkles, Dice5, Loader2, Flame, Check, X } from "lucide-react";
import { createPortal } from "react-dom";
import { type RegionFilter, type MealSlotFilter, type StyleFilter, styleFilters, isLightRecommendation, matchesRecommendationFilters, regionFilters, mealSlotFilters } from "@/features/recommendation/domain/filters";
import { countMainMeals, getCompletionSnapshot, uniqueRecommendations, rankRecommendation } from "@/features/recommendation/domain/ranking";
import { buildBottomFoodShufflePool, pickStratifiedShuffleWinner } from "@/features/recommendation/domain/shuffle";
import { localizeRecommendationTitle, RecommendationCard } from "@/features/recommendation/ui/RecommendationCard";
import { FilterGroup, FilterButton } from "@/features/recommendation/ui/FilterControls";

const AI_RECOMMENDATION_COUNT = 30;

type RecommendationsProps = {
  preview?: boolean;
  portalTarget?: Element | null;
  profile: UserProfile;
  day: DayState;
  gaps: MacroTotals;
  targets: MacroTotals;
  totals: MacroTotals;
  foods: FoodLogItem[];
  onChoose: (food: FoodLogItem) => void;
  onRecognizeRequested: () => void;
};

export function Recommendations({ preview = false, portalTarget, profile, day, gaps, targets, totals, foods, onChoose, onRecognizeRequested }: RecommendationsProps) {
  const { t, language } = useI18n();
  const [visibleCount, setVisibleCount] = useState(6);
  const [aiRecommendations, setAiRecommendations] = useState<Recommendation[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [mealSlotFilter, setMealSlotFilter] = useState<MealSlotFilter>("all");
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("all");
  useEffect(() => { setVisibleCount(6); }, [regionFilter, mealSlotFilter, styleFilter]);
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
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector<HTMLElement>(".shuffle-flashcard");
    if (preview) dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!preview) return;
      if (event.key === "Escape") { event.preventDefault(); setShuffleOpen(false); }
      if (event.key === "Tab" && dialog) {
        const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (preview) previousFocus?.focus({ preventScroll: true });
    };
  }, [shuffleOpen, preview]);

  function startShuffle() {
    if (!shufflePool.length) return;
    setShuffleDone(false);
    setShuffleIndex(Math.floor(Math.random() * shufflePool.length));
    setShuffleRunId((current) => current + 1);
    setShuffleOpen(true);
  }

  async function requestAiRecommendations() {
    setIsAiLoading(true);
    setAiNotice(t("AI 正在从系统食物库里帮你补 {count} 种候选...", { count: AI_RECOMMENDATION_COUNT }));

    try {
      const response = await fetch("/api/recommend-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang: language,
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
        setAiNotice(result.message || t("AI 推荐暂时没有生成成功，先用本地推荐池。"));
        return;
      }

      const next = (result.recommendations ?? []) as Recommendation[];
      setAiRecommendations((current) => uniqueRecommendations([...next, ...current]).slice(0, AI_RECOMMENDATION_COUNT));
      setAiNotice(next.length ? t("AI 新增了 {count} 个候选，已经混进推荐池。", { count: next.length }) : t("AI 暂时没有给出新候选，先用本地推荐池。"));
    } catch {
      setAiNotice(t("AI 推荐请求失败了，先用本地推荐池。"));
    } finally {
      setIsAiLoading(false);
    }
  }

  return (
    <div className="recommend-experience">
      <section className="recommend-hero">
        <img src="/images/recommendation-rail-v2.png" alt={t("为今天推荐的三种均衡餐食")} />
        <div className="recommend-hero__veil" />
        <div className="recommend-hero__content">
          <span className="experience-kicker experience-kicker--light"><Sparkles size={14} /> For your next bite</span>
          <h1><span>{t("下一餐，")}</span>{language === "en" ? " " : ""}<span>{t("不靠猜。")}</span></h1>
          <p>{shouldLightOnly ? t("当前营养完成度较高，优先推荐水果、酸奶或轻量加餐。") : t("根据已有饮食记录、训练状态和营养缺口生成推荐。")}</p>
          <div className="recommend-hero__metrics">
            <div><span>{t("今日完成")}</span><strong>{currentPercentages.average}%</strong></div>
            <div><span>{t("蛋白缺口")}</span><strong>{Math.max(0, Math.round(gaps.protein))}g</strong></div>
            <div><span>{t("已记录")}</span><strong>{mainMealCount} {t("餐")}</strong></div>
          </div>
          <div className="recommend-hero__actions">
            <button type="button" onClick={startShuffle}><Dice5 size={18} /> {t("帮我选一个")}</button>
            <button type="button" onClick={requestAiRecommendations} disabled={isAiLoading}>
              {isAiLoading ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />} {t("AI 生成更多")}
            </button>
            <button type="button" onClick={onRecognizeRequested}>{t("重新识别食物")}</button>
          </div>
          {aiNotice ? <p className="recommend-hero__notice">{aiNotice}</p> : null}
        </div>
      </section>

      {picked ? (
        <section className="picked-meal">
          <div><span><Flame size={15} /> {t("此刻最合适")}</span><h2>{localizeRecommendationTitle(picked.title, t)}</h2><p>{t(picked.brand)} · {t(dietStatusLabels[day.dietStatus].label)}</p></div>
          <div className="picked-meal__macros">
            <span><strong>{Math.round(picked.macros.protein)}g</strong> {t("蛋白")}</span>
            <span><strong>{Math.round(picked.macros.calories)}</strong> kcal</span>
          </div>
          <button type="button" onClick={() => onChoose(recommendationToFood(picked))}><Check size={17} /> {t("就吃这个")}</button>
        </section>
      ) : null}

      <section className="recommendation-library">
        <div className="section-heading">
          <div><span className="experience-kicker">Curated for you</span><h2>{t("推荐方案")}</h2></div>
          <p>{t("{count} 个匹配方案", { count: filteredRanked.length })} · {shouldLightOnly ? t("轻补模式") : t("平衡正餐模式")}</p>
        </div>

        <div className="recommend-filters">
          <FilterGroup label={t("餐饮地域")}>
            {regionFilters.map((filter) => (
              <FilterButton
                key={filter.value}
                active={regionFilter === filter.value}
                onClick={() => setRegionFilter(filter.value)}
              >
                {t(filter.label)}
              </FilterButton>
            ))}
          </FilterGroup>
          <FilterGroup label={t("餐别")}>
            {mealSlotFilters.map((filter) => (
              <FilterButton
                key={filter.value}
                active={mealSlotFilter === filter.value}
                onClick={() => setMealSlotFilter(filter.value)}
              >
                {t(filter.label)}
              </FilterButton>
            ))}
          </FilterGroup>
          <FilterGroup label={t("品类")}>
            {availableStyleFilters.map((filter) => (
              <FilterButton
                key={filter.value}
                active={styleFilter === filter.value}
                onClick={() => setStyleFilter(filter.value)}
              >
                {t(filter.label)}
              </FilterButton>
            ))}
          </FilterGroup>
        </div>

        <div className="recommendation-grid">
          {(preview ? filteredRanked.slice(0, visibleCount) : filteredRanked).map((recommendation) => (
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
        {preview && visibleCount < filteredRanked.length && <div className="mt-8 text-center"><button type="button" className="precision-button precision-button--secondary" onClick={() => setVisibleCount((count) => count + 6)}>{language === "en" ? `Show more (${filteredRanked.length - visibleCount} remaining)` : `显示更多（还有 ${filteredRanked.length - visibleCount} 个）`}</button></div>}
        {!filteredRanked.length ? (
          <div className="empty-recommendations">
            <p className="text-lg font-black text-ink">{t("这个筛选组合暂时没有候选")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/55">{t("可以放宽一个筛选项，或者点 AI 再推荐 30 种。")}</p>
          </div>
        ) : null}
      </section>

      {shuffleOpen && shuffleCandidate ? createPortal(
        <div className="shuffle-overlay">
          <section className={`shuffle-flashcard ${shuffleDone ? "is-complete" : "is-shuffling"}`} role="dialog" aria-modal="true" aria-label={t("随机推荐结果")}>
            <div className="shuffle-flashcard__header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Random Pick</p>
                <h2 className="mt-1 text-2xl font-black text-ink">{t("随机推荐")}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShuffleOpen(false)}
                aria-label={t("关闭随机推荐")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-ink/12 bg-paper text-ink"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="shuffle-flashcard__stage">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-moss">
                {shuffleDone ? t("摇到了") : t("正在为你翻牌")}
              </p>
              <h3 className="mt-3 text-3xl font-black leading-tight text-ink">{localizeRecommendationTitle(shuffleCandidate.title, t)}</h3>
              <p className="mt-2 text-sm font-bold text-ink/58">{t(shuffleCandidate.brand)}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {shuffleCandidate.items.map((item) => (
                  <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink/62">
                    {t(item)}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold text-ink/62">
                {t("蛋白")} {Math.round(shuffleCandidate.macros.protein)}g · {t("碳水")} {Math.round(shuffleCandidate.macros.carbs)}g · {t("脂肪")} {Math.round(shuffleCandidate.macros.fat)}g
              </p>
              {shuffleDone ? (
                <div className="mt-4 rounded-[18px] border border-white bg-white/80 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">{t("吃完预计达成")}</p>
                  <p className="mt-1 text-3xl font-black text-ink">{shuffleCompletion.average}%</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {macroKeys.map((macro) => (
                      <div key={macro} className="rounded-[18px] bg-paper px-2 py-2">
                        <p className="text-[11px] font-bold text-ink/45">{t(macroLabels[macro].short)}</p>
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
                {t("就吃摇到的")}
              </button>
              <button
                type="button"
                onClick={startShuffle}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] border border-ink/12 bg-paper px-4 text-sm font-black text-ink"
              >
                <Dice5 size={17} aria-hidden="true" />
                {t("再摇一次")}
              </button>
            </div>
          </section>
        </div>,
        portalTarget ?? document.body
      ) : null}
    </div>
  );
}
