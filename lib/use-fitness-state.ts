"use client";

import { useEffect, useMemo, useState } from "react";
import { getBeijingDateKey } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import { acknowledgeFeedbackMilestone, completeRecognitionFlow, emptyFeedbackProgress, feedbackProgressKey, nextFeedbackMilestone, parseFeedbackProgress } from "@/lib/feedback-progress";
import { calculateRecommendedFiberGrams, calculateRecommendedMacroMultipliers, calculateTargets, defaultDayState, defaultProfile, hasMeaningfulGap, normalizeFiberGrams, normalizeMacroMultipliers, remainingMacros, sumFoods } from "@/lib/nutrition";
import type { DayRecord, DayState, FoodLogItem, UserProfile } from "@/lib/types";

const profileKey = "ffe-profile";
const dayKey = "ffe-day";
const foodsKey = "ffe-foods";
const recordsKey = "ffe-day-records";

export function useFitnessState(snapshotBeforeWrite = false) {
  const { language } = useI18n();
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [day, setDay] = useState<DayState>(defaultDayState);
  const [foods, setFoods] = useState<FoodLogItem[]>([]);
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [currentDateKey, setCurrentDateKey] = useState(getBeijingDateKey());
  const [selectedDateKey, setSelectedDateKey] = useState(getBeijingDateKey());
  const [hasProfile, setHasProfile] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [topUpPromptOpen, setTopUpPromptOpen] = useState(false);
  const [feedbackProgress, setFeedbackProgress] = useState(emptyFeedbackProgress);

  useEffect(() => {
    if (snapshotBeforeWrite && !window.localStorage.getItem("ffe-before-preview-v1")) {
      const keys = [profileKey, dayKey, foodsKey, recordsKey, "ffe-language"];
      window.localStorage.setItem("ffe-before-preview-v1", JSON.stringify({
        origin: window.location.origin, createdAt: new Date().toISOString(),
        values: Object.fromEntries(keys.map((key) => [key, window.localStorage.getItem(key)]))
      }));
    }
    const today = getBeijingDateKey();
    setFeedbackProgress(parseFeedbackProgress(window.localStorage.getItem(feedbackProgressKey)));
    const storedProfile = window.localStorage.getItem(profileKey);
    const storedDay = window.localStorage.getItem(dayKey);
    const storedFoods = window.localStorage.getItem(foodsKey);
    const storedRecords = window.localStorage.getItem(recordsKey);
    const parsedRecords = storedRecords ? parseRecords(storedRecords) : {};

    if (storedProfile) {
      setProfile(normalizeProfile(JSON.parse(storedProfile) as Partial<UserProfile>));
      setHasProfile(true);
    }

    if (!parsedRecords[today]) {
      parsedRecords[today] = {
        dateKey: today,
        day: storedDay ? normalizeDay(JSON.parse(storedDay) as Partial<DayState>) : defaultDayState,
        foods: storedFoods ? normalizeFoods(JSON.parse(storedFoods) as Partial<FoodLogItem>[]) : []
      };
    }

    const todayRecord = parsedRecords[today];
    setRecords(parsedRecords);
    setCurrentDateKey(today);
    setSelectedDateKey(today);
    setDay(normalizeDay(todayRecord.day));
    setFoods(normalizeFoods(todayRecord.foods));

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !hasProfile) return;
    window.localStorage.setItem(profileKey, JSON.stringify(profile));
  }, [hydrated, hasProfile, profile]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(feedbackProgressKey, JSON.stringify(feedbackProgress));
  }, [hydrated, feedbackProgress]);

  const savedFoods = useMemo(() => foods.filter((food) => food.savedToCalendar), [foods]);

  useEffect(() => {
    if (!hydrated || (snapshotBeforeWrite && !hasProfile)) return;
    setRecords((current) => ({
      ...current,
      [currentDateKey]: {
        dateKey: currentDateKey,
        day,
        foods: savedFoods
      }
    }));
  }, [currentDateKey, day, hydrated, savedFoods, snapshotBeforeWrite, hasProfile]);

  useEffect(() => {
    if (!hydrated || (snapshotBeforeWrite && !hasProfile)) return;
    window.localStorage.setItem(recordsKey, JSON.stringify(records));
  }, [hydrated, records, snapshotBeforeWrite, hasProfile]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => {
      const today = getBeijingDateKey();
      if (today === currentDateKey) return;

      const nextRecord = records[today] ?? { dateKey: today, day: defaultDayState, foods: [] };
      setCurrentDateKey(today);
      setSelectedDateKey(today);
      setDay(normalizeDay(nextRecord.day));
      setFoods(normalizeFoods(nextRecord.foods));
      setRecords((current) => ({
        ...current,
        [today]: nextRecord
      }));
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [currentDateKey, hydrated, records]);

  const targets = useMemo(() => calculateTargets(profile, day), [profile, day]);
  const totals = useMemo(() => sumFoods(savedFoods), [savedFoods]);
  const gaps = useMemo(() => remainingMacros(targets, totals), [targets, totals]);
  const selectedRecord = selectedDateKey === currentDateKey
    ? { dateKey: currentDateKey, day, foods: savedFoods }
    : records[selectedDateKey] ?? { dateKey: selectedDateKey, day: defaultDayState, foods: [] };
  const selectedDay = normalizeDay(selectedRecord.day);
  const selectedFoods = normalizeFoods(selectedRecord.foods);
  const selectedTargets = useMemo(() => calculateTargets(profile, selectedDay), [profile, selectedDay]);
  const selectedTotals = useMemo(() => sumFoods(selectedFoods), [selectedFoods]);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    [language]
  );

  function completeProfile(nextProfile: UserProfile, nextDay: DayState) {
    setProfile(nextProfile);
    setDay(nextDay);
    setHasProfile(true);
  }

  function addFoods(newFoods: FoodLogItem[]) {
    if (!newFoods.length) return;
    const recognitionBatchId = crypto.randomUUID();
    setFoods((current) => [...newFoods.map((food) => ({ ...markFoodAsDraft(food), recognitionBatchId })), ...current]);
  }

  function chooseRecommendation(food: FoodLogItem) {
    const afterChoiceGaps = remainingMacros(gaps, food.macros);
    setFoods((current) => [markFoodAsDraft(food), ...current]);
    setTopUpPromptOpen(hasMeaningfulGap(afterChoiceGaps));
  }

  function removeFood(id: string) {
    setFoods((current) => current.filter((food) => food.id !== id || food.savedToCalendar));
  }

  function saveFoodToCalendar(id: string) {
    const food = foods.find((item) => item.id === id);
    if (!food || food.savedToCalendar) return;
    setFoods((current) =>
      current.map((food) => (food.id === id ? { ...food, savedToCalendar: true } : food))
    );
    setFeedbackProgress((progress) => completeRecognitionFlow(progress, food.recognitionBatchId));
  }

  function acknowledgeFeedbackInvitation(milestone: number) {
    setFeedbackProgress((progress) => acknowledgeFeedbackMilestone(progress, milestone));
  }

  function clearDraftFoods() {
    setFoods((current) => current.filter((food) => food.savedToCalendar));
  }

  return { profile, day, foods, records, currentDateKey, selectedDateKey, hasProfile, hydrated,
    topUpPromptOpen, setTopUpPromptOpen, setDay, setSelectedDateKey, savedFoods, targets, totals, gaps,
    selectedDay, selectedFoods, selectedTargets, selectedTotals, todayLabel, completeProfile,
    addFoods, chooseRecommendation, removeFood, saveFoodToCalendar, clearDraftFoods,
    completedRecognitionFlows: feedbackProgress.completedBatchIds.length,
    feedbackMilestone: nextFeedbackMilestone(feedbackProgress), acknowledgeFeedbackInvitation };
}

function normalizeProfile(profile: Partial<UserProfile>): UserProfile {
  const merged = { ...defaultProfile, ...profile };
  const validTrainingStyles = ["三分化", "五分化", "功能性训练", "徒手训练", "不训练"];
  const validDietPatterns = ["三餐正常", "16+8 间歇性断食", "碳循环", "地中海 / 均衡饮食", "外卖 / 便利店为主", "不确定，先按普通模式算"];
  const normalized = {
    ...merged,
    bmrKcal: merged.bmrKcal || defaultProfile.bmrKcal,
    trainingStyle: validTrainingStyles.includes(merged.trainingStyle) ? merged.trainingStyle : defaultProfile.trainingStyle,
    eatingPattern: validDietPatterns.includes(merged.eatingPattern) ? merged.eatingPattern : defaultProfile.eatingPattern
  };

  return {
    ...normalized,
    macroMultipliers: profile.macroMultipliers
      ? normalizeMacroMultipliers(
        profile.macroMultipliers,
        calculateRecommendedMacroMultipliers(normalized, defaultDayState)
      )
      : undefined,
    fiberGrams: profile.fiberGrams
      ? normalizeFiberGrams(
        profile.fiberGrams,
        calculateRecommendedFiberGrams(normalized, defaultDayState)
      )
      : undefined
  };
}

function parseRecords(raw: string): Record<string, DayRecord> {
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<DayRecord>>;
    return Object.fromEntries(
      Object.entries(parsed).map(([dateKey, record]) => [
        dateKey,
        {
          dateKey,
          day: normalizeDay(record.day ?? defaultDayState),
          foods: normalizeFoods(record.foods ?? [])
        }
      ])
    );
  } catch {
    return {};
  }
}

function normalizeDay(day: Partial<DayState>): DayState {
  return {
    ...defaultDayState,
    ...day,
    trainingSets: Number.isFinite(day.trainingSets) ? day.trainingSets ?? defaultDayState.trainingSets : defaultDayState.trainingSets,
    durationMinutes: Number.isFinite(day.durationMinutes) ? day.durationMinutes ?? defaultDayState.durationMinutes : defaultDayState.durationMinutes,
    dietStatus: ["normal", "high_carb", "low_carb", "high_protein", "free"].includes(day.dietStatus ?? "")
      ? (day.dietStatus as DayState["dietStatus"])
      : defaultDayState.dietStatus
  };
}

function normalizeFoods(foods: Partial<FoodLogItem>[]): FoodLogItem[] {
  return foods.map((food) => ({
    id: food.id ?? `food-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: food.name ?? "未命名食物",
    brand: food.brand,
    foodType: food.foodType ?? "食品",
    portionLabel: food.portionLabel ?? "标准份",
    portionScale: food.portionScale ?? 1,
    baseMacros: food.baseMacros ?? food.macros ?? { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 },
    macros: food.macros ?? { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 },
    meal: food.meal ?? "snack",
    warning: food.warning,
    source: ["ai-text", "manual", "recommendation"].includes(food.source ?? "")
      ? (food.source as FoodLogItem["source"])
      : "manual",
    recognitionMode: food.recognitionMode,
    sourceLabel: food.sourceLabel,
    loggedAt: food.loggedAt ?? new Date().toISOString(),
    savedToCalendar: food.savedToCalendar ?? true,
    recognitionBatchId: typeof food.recognitionBatchId === "string" ? food.recognitionBatchId : undefined
  }));
}

function markFoodAsDraft(food: FoodLogItem): FoodLogItem {
  return {
    ...food,
    savedToCalendar: false
  };
}
