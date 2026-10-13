"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeSearchEvidence } from "@/lib/search-evidence";
import { getBeijingDateKey } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cloudApi, describeCloudError, type EntryResult } from "@/lib/cloud/client";
import type { CloudDay, CloudState } from "@/lib/cloud/types";
import { acknowledgeFeedbackMilestone, completeRecognitionFlow, emptyFeedbackProgress, feedbackProgressKey, nextFeedbackMilestone, parseFeedbackProgress, type FeedbackProgress } from "@/lib/feedback-progress";
import { calculateRecommendedFiberGrams, calculateRecommendedMacroMultipliers, calculateTargets, defaultDayState, defaultProfile, hasMeaningfulGap, normalizeFiberGrams, normalizeMacroMultipliers, remainingMacros, sumFoods } from "@/lib/nutrition";
import type { DayRecord, DayState, FoodLogItem, MacroTotals, UserProfile } from "@/lib/types";

const profileKey = "ffe-profile";
const dayKey = "ffe-day";
const foodsKey = "ffe-foods";
const recordsKey = "ffe-day-records";
const SYNC_MIN_INTERVAL_MS = 30_000;

export type DayStatus = { kind: "open" | "effective" | "ineffective" | "migrated"; flows: number };

/**
 * Local mode (no backend configured): everything lives in localStorage, as before.
 * Cloud mode (signed in): the backend is the source of truth. Nothing about the account is written to
 * shared localStorage keys, so switching accounts on one device never shows the previous account's data.
 */
export function useFitnessState(snapshotBeforeWrite = false) {
  const { language } = useI18n();
  const auth = useAuth();
  const cloudMode = auth.status === "signed_in";
  const localMode = auth.status === "disabled";
  const userId = auth.user?.id ?? null;

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
  const [dayMeta, setDayMeta] = useState<Record<string, CloudDay>>({});
  const [profileVersion, setProfileVersion] = useState<number | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [busyFoodIds, setBusyFoodIds] = useState<string[]>([]);

  const inflight = useRef(0);
  const syncing = useRef(false);
  const lastSyncAt = useRef(0);
  const lastRolloverTrigger = useRef("");
  const dayChain = useRef<Promise<void>>(Promise.resolve());
  const busyRef = useRef(new Set<string>());
  const feedbackLoaded = useRef(false);
  const currentDateKeyRef = useRef(currentDateKey);
  currentDateKeyRef.current = currentDateKey;

  // ---- local mode hydration -------------------------------------------------------------------
  useEffect(() => {
    if (snapshotBeforeWrite && !window.localStorage.getItem("ffe-before-preview-v1")) {
      const keys = [profileKey, dayKey, foodsKey, recordsKey, "ffe-language"];
      window.localStorage.setItem("ffe-before-preview-v1", JSON.stringify({
        origin: window.location.origin, createdAt: new Date().toISOString(),
        values: Object.fromEntries(keys.map((key) => [key, window.localStorage.getItem(key)]))
      }));
    }
  }, [snapshotBeforeWrite]);

  useEffect(() => {
    if (!localMode) return;
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
  }, [localMode]);

  useEffect(() => {
    if (!localMode || !hydrated || !hasProfile) return;
    window.localStorage.setItem(profileKey, JSON.stringify(profile));
  }, [localMode, hydrated, hasProfile, profile]);

  useEffect(() => {
    if (localMode && hydrated) window.localStorage.setItem(feedbackProgressKey, JSON.stringify(feedbackProgress));
  }, [localMode, hydrated, feedbackProgress]);

  // ---- cloud mode: hydration, refresh, sign-out reset -----------------------------------------
  const applyCloudState = useCallback((state: CloudState) => {
    const nextRecords: Record<string, DayRecord> = {};
    for (const entry of Object.values(state.days)) {
      nextRecords[entry.dateKey] = {
        dateKey: entry.dateKey, day: entry.day, foods: [], targets: entry.targets, totals: entry.totals,
        flows: entry.flows, score: entry.score, finalized: entry.finalized, effective: entry.effective, migrated: entry.migrated
      };
    }
    for (const food of state.foods) {
      if (!food.savedToCalendar || !food.entryDate) continue;
      (nextRecords[food.entryDate] ??= { dateKey: food.entryDate, day: defaultDayState, foods: [] }).foods.push(food);
    }
    const todayDay = state.days[state.today]?.day ?? defaultDayState;
    setDayMeta(state.days);
    setRecords(nextRecords);
    setCurrentDateKey(state.today);
    setSelectedDateKey((selected) => (nextRecords[selected] && selected !== currentDateKeyRef.current ? selected : state.today));
    setDay(todayDay);
    setFoods((previous) => [
      ...previous.filter((food) => !food.cloud && !food.savedToCalendar),
      ...state.foods.filter((food) => food.entryDate === state.today)
    ]);
    setProfileVersion(state.profileVersion);
    if (state.profile) {
      setProfile(normalizeProfile(state.profile));
      setHasProfile(true);
    } else {
      setProfile(defaultProfile);
      setHasProfile(false);
    }
    if (!feedbackLoaded.current) {
      feedbackLoaded.current = true;
      setFeedbackProgress(parseFeedbackProgress(JSON.stringify(state.feedbackProgress ?? null)));
    }
  }, []);

  const resync = useCallback(async (force = false) => {
    if (syncing.current || inflight.current > 0) return;
    if (!force && Date.now() - lastSyncAt.current < SYNC_MIN_INTERVAL_MS) return;
    syncing.current = true;
    try {
      applyCloudState(await cloudApi.sync());
      lastSyncAt.current = Date.now();
      lastRolloverTrigger.current = getBeijingDateKey();
      setCloudError(null);
      setHydrated(true);
    } catch (error) {
      setCloudError(describeCloudError(error, language));
    } finally {
      syncing.current = false;
    }
  }, [applyCloudState, language]);

  useEffect(() => {
    if (!cloudMode || !userId) return;
    feedbackLoaded.current = false;
    setHydrated(false);
    void resync(true);
  }, [cloudMode, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (auth.status !== "signed_out") return;
    setProfile(defaultProfile);
    setDay(defaultDayState);
    setFoods([]);
    setRecords({});
    setDayMeta({});
    setHasProfile(false);
    setHydrated(false);
    setProfileVersion(null);
    setFeedbackProgress(emptyFeedbackProgress());
    setCloudError(null);
  }, [auth.status]);

  useEffect(() => {
    if (!cloudMode) return;
    const refresh = () => { if (document.visibilityState === "visible") void resync(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [cloudMode, resync]);

  useEffect(() => {
    if (!cloudMode || !hydrated || !feedbackLoaded.current) return;
    const timer = window.setTimeout(() => { void cloudApi.saveFeedbackProgress(feedbackProgress).catch(() => undefined); }, 1500);
    return () => window.clearTimeout(timer);
  }, [cloudMode, hydrated, feedbackProgress]);

  // ---- derived values -------------------------------------------------------------------------
  const savedFoods = useMemo(() => foods.filter((food) => food.savedToCalendar), [foods]);

  useEffect(() => {
    if (!hydrated || (snapshotBeforeWrite && !hasProfile)) return;
    setRecords((current) => ({
      ...current,
      [currentDateKey]: {
        ...current[currentDateKey],
        dateKey: currentDateKey,
        day,
        foods: savedFoods
      }
    }));
  }, [currentDateKey, day, hydrated, savedFoods, snapshotBeforeWrite, hasProfile]);

  useEffect(() => {
    if (!localMode || !hydrated || (snapshotBeforeWrite && !hasProfile)) return;
    window.localStorage.setItem(recordsKey, JSON.stringify(records));
  }, [localMode, hydrated, records, snapshotBeforeWrite, hasProfile]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => {
      const today = getBeijingDateKey();
      if (today === currentDateKey) return;

      if (cloudMode) {
        // The server decides the date; try again at most once per observed local date change.
        if (lastRolloverTrigger.current !== today) { lastRolloverTrigger.current = today; void resync(true); }
        return;
      }

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
  }, [cloudMode, currentDateKey, hydrated, records, resync]);

  const todayMeta = cloudMode ? dayMeta[currentDateKey] : undefined;
  const targets = useMemo(() => calculateTargets(profile, day), [profile, day]);
  const totals = useMemo(() => (todayMeta ? todayMeta.totals : sumFoods(savedFoods)), [todayMeta, savedFoods]);
  const gaps = useMemo(() => remainingMacros(targets, totals), [targets, totals]);
  const selectedRecord = selectedDateKey === currentDateKey
    ? { dateKey: currentDateKey, day, foods: savedFoods }
    : records[selectedDateKey] ?? { dateKey: selectedDateKey, day: defaultDayState, foods: [] };
  const selectedDay = normalizeDay(selectedRecord.day);
  const selectedFoods = normalizeFoods(selectedRecord.foods);
  const selectedSnapshot = selectedDateKey === currentDateKey ? null : (selectedRecord as DayRecord).targets ?? null;
  const calculatedSelectedTargets = useMemo(() => calculateTargets(profile, selectedDay), [profile, selectedDay]);
  const selectedTargets: MacroTotals = selectedSnapshot ?? calculatedSelectedTargets;
  const selectedMeta: DayRecord | undefined = selectedDateKey === currentDateKey ? undefined : (selectedRecord as DayRecord);
  const selectedFoodTotals = useMemo(() => sumFoods(selectedFoods), [selectedFoods]);
  const selectedTotals: MacroTotals = selectedDateKey === currentDateKey ? totals : selectedMeta?.totals ?? selectedFoodTotals;
  const selectedStatus: DayStatus | null = !cloudMode ? null
    : selectedDateKey === currentDateKey ? { kind: "open", flows: todayMeta?.flows ?? 0 }
    : selectedMeta && selectedMeta.flows !== undefined
      ? { kind: selectedMeta.migrated ? "migrated" : selectedMeta.effective === true ? "effective" : selectedMeta.effective === false ? "ineffective" : "open", flows: selectedMeta.flows }
      : null;
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    [language]
  );

  // ---- mutations ------------------------------------------------------------------------------
  const failWith = useCallback((error: unknown, refresh = false) => {
    setCloudError(describeCloudError(error, language));
    // Deferred so an in-flight mutation has released its slot before the refresh runs.
    if (refresh) window.setTimeout(() => void resync(true), 0);
  }, [language, resync]);

  async function track<T>(work: () => Promise<T>): Promise<T> {
    inflight.current += 1;
    try { return await work(); } finally { inflight.current -= 1; }
  }

  function applyEntryResult(previousId: string, result: EntryResult) {
    setFoods((current) => current.map((food) => (food.id === previousId ? result.food : food)));
    if (result.day) {
      const next = result.day;
      setDayMeta((current) => ({ ...current, [next.dateKey]: next }));
    }
  }

  async function withBusy(id: string, work: () => Promise<void>) {
    if (busyRef.current.has(id)) return;
    busyRef.current.add(id);
    setBusyFoodIds(Array.from(busyRef.current));
    try { await track(work); } finally {
      busyRef.current.delete(id);
      setBusyFoodIds(Array.from(busyRef.current));
    }
  }

  /** Resolves true when the profile is saved. In cloud mode the server recomputes today's goal snapshot. */
  async function completeProfile(nextProfile: UserProfile, nextDay: DayState): Promise<boolean> {
    if (!cloudMode) {
      setProfile(nextProfile);
      setDay(nextDay);
      setHasProfile(true);
      return true;
    }
    try {
      const saved = await track(() => cloudApi.saveProfile(nextProfile, nextDay, hasProfile ? profileVersion : null));
      setProfile(nextProfile);
      setDay(nextDay);
      setHasProfile(true);
      setProfileVersion(saved.profileVersion);
      setDayMeta((current) => ({ ...current, [saved.day.dateKey]: saved.day }));
      setCloudError(null);
      return true;
    } catch (error) {
      failWith(error, true);
      return false;
    }
  }

  function updateDay(nextDay: DayState) {
    setDay(nextDay);
    if (!cloudMode) return;
    inflight.current += 1;
    // Saves run strictly in order so the last toggle wins on the server too.
    const done = dayChain.current.then(async () => {
      try {
        const saved = await cloudApi.saveDay(nextDay);
        setDayMeta((current) => ({ ...current, [saved.dateKey]: saved }));
        return true;
      } catch (error) {
        setCloudError(describeCloudError(error, language));
        return false;
      }
    });
    dayChain.current = done.then(() => undefined);
    void done.then((ok) => {
      inflight.current = Math.max(0, inflight.current - 1);
      if (!ok) void resync(true);
    });
  }

  function addFoods(newFoods: FoodLogItem[]) {
    if (!newFoods.length) return;
    const recognitionBatchId = newFoods.find((food) => food.recognitionBatchId)?.recognitionBatchId ?? crypto.randomUUID();
    setFoods((current) => [
      ...newFoods.map((food) => ({ ...(food.cloud && food.savedToCalendar ? food : markFoodAsDraft(food)), recognitionBatchId: food.recognitionBatchId ?? recognitionBatchId })),
      ...current.filter((existing) => !newFoods.some((food) => food.id === existing.id))
    ]);
  }

  function chooseRecommendation(food: FoodLogItem) {
    const afterChoiceGaps = remainingMacros(gaps, food.macros);
    setFoods((current) => [markFoodAsDraft(food), ...current]);
    setTopUpPromptOpen(hasMeaningfulGap(afterChoiceGaps));
  }

  function removeFood(id: string) {
    const food = foods.find((item) => item.id === id);
    if (!food) return;
    if (!cloudMode) {
      if (!food.savedToCalendar) setFoods((current) => current.filter((item) => item.id !== id));
      return;
    }
    if (!food.cloud) {
      setFoods((current) => current.filter((item) => item.id !== id));
      return;
    }
    void withBusy(id, async () => {
      try {
        const result = await cloudApi.deleteEntry(id);
        setFoods((current) => current.filter((item) => item.id !== id));
        if (result.day) {
          const next = result.day;
          setDayMeta((current) => ({ ...current, [next.dateKey]: next }));
        }
      } catch (error) {
        failWith(error, true);
      }
    });
  }

  function saveFoodToCalendar(id: string) {
    const food = foods.find((item) => item.id === id);
    if (!food || food.savedToCalendar) return;
    if (!cloudMode) {
      setFoods((current) => current.map((item) => (item.id === id ? { ...item, savedToCalendar: true } : item)));
      setFeedbackProgress((progress) => completeRecognitionFlow(progress, food.recognitionBatchId));
      return;
    }
    void withBusy(id, async () => {
      try {
        const result = food.cloud
          ? await cloudApi.confirmEntry(id)
          : await cloudApi.createEntry(food, food.source === "recommendation" ? "recommendation" : "manual", true);
        applyEntryResult(id, result);
        setFeedbackProgress((progress) => completeRecognitionFlow(progress, food.recognitionBatchId));
      } catch (error) {
        failWith(error, true);
      }
    });
  }

  function acknowledgeFeedbackInvitation(milestone: number) {
    setFeedbackProgress((progress: FeedbackProgress) => acknowledgeFeedbackMilestone(progress, milestone));
  }

  function clearDraftFoods() {
    const drafts = foods.filter((food) => !food.savedToCalendar);
    if (!cloudMode) {
      setFoods((current) => current.filter((food) => food.savedToCalendar));
      return;
    }
    setFoods((current) => current.filter((food) => food.savedToCalendar || (food.cloud && busyRef.current.has(food.id))));
    for (const draft of drafts.filter((food) => food.cloud)) {
      void withBusy(draft.id, async () => {
        try { await cloudApi.deleteEntry(draft.id); } catch (error) { failWith(error, true); }
      });
    }
  }

  return { profile, day, foods, records, currentDateKey, selectedDateKey, hasProfile, hydrated,
    topUpPromptOpen, setTopUpPromptOpen, setDay: updateDay, setSelectedDateKey, savedFoods, targets, totals, gaps,
    selectedDay, selectedFoods, selectedTargets, selectedTotals, todayLabel, completeProfile,
    addFoods, chooseRecommendation, removeFood, saveFoodToCalendar, clearDraftFoods,
    completedRecognitionFlows: feedbackProgress.completedBatchIds.length,
    feedbackMilestone: nextFeedbackMilestone(feedbackProgress), acknowledgeFeedbackInvitation,
    cloudMode, cloudError, clearCloudError: () => setCloudError(null), retrySync: () => resync(true), busyFoodIds,
    todayScore: todayMeta?.score ?? null, todayFlows: todayMeta?.flows ?? 0,
    selectedScore: selectedDateKey === currentDateKey ? todayMeta?.score ?? null : selectedMeta?.score ?? null,
    selectedStatus };
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
    ...food,
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
    recognitionBatchId: typeof food.recognitionBatchId === "string" ? food.recognitionBatchId : undefined,
    searchEvidence: normalizeSearchEvidence(food.searchEvidence)
  }));
}

function markFoodAsDraft(food: FoodLogItem): FoodLogItem {
  return {
    ...food,
    savedToCalendar: false
  };
}
