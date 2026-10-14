"use client";

import { useI18n } from "@/shared/i18n/i18n";
import { useAuth } from "@/shared/auth/AuthProvider";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { UserProfile, DayState, FoodLogItem, DayRecord, MacroTotals } from "@/shared/domain/types";
import { defaultProfile, defaultDayState, calculateTargets, sumFoods, remainingMacros, addMacros } from "@/shared/domain/nutrition";
import { hasMeaningfulGap } from "@/shared/domain/recommendation-fit";
import { getBeijingDateKey } from "@/shared/domain/dates";
import { emptyFeedbackProgress, parseFeedbackProgress, feedbackProgressKey, completeRecognitionFlow, type FeedbackProgress, acknowledgeFeedbackMilestone, nextFeedbackMilestone } from "@/shared/domain/feedback-progress";
import type { CloudDay, LocalImportState, CloudState } from "@/shared/api/types";
import { cloudApi, describeCloudError, type EntryResult } from "@/shared/api/client";
import { legacyToImport } from "@/shared/api/import";
import { profileKey, dayKey, foodsKey, recordsKey, parseRecords, normalizeProfile, normalizeDay, normalizeFoods, markFoodAsDraft } from "@/features/daily-log/state/local-records";

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
  const [localImportState, setLocalImportState] = useState<LocalImportState>("pending");

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
    setLocalImportState(state.localImportState);
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
    // Optimistic: show the food as counted at once; the server reply replaces it, and a failure resyncs.
    setFoods((current) => current.map((item) => (item.id === id ? { ...item, savedToCalendar: true } : item)));
    setDayMeta((current) => {
      const today = current[currentDateKey];
      return today ? { ...current, [currentDateKey]: { ...today, totals: addMacros(today.totals, food.macros) } } : current;
    });
    void withBusy(id, async () => {
      try {
        const result = food.cloud
          ? await cloudApi.confirmEntry(id)
          : await cloudApi.createEntry(food, food.source === "recommendation" ? "recommendation" : "manual", true);
        applyEntryResult(id, result);
        setFeedbackProgress((progress) => completeRecognitionFlow(progress, food.recognitionBatchId));
      } catch (error) {
        setFoods((current) => current.map((item) => (item.id === id ? { ...item, savedToCalendar: false } : item)));
        setDayMeta((current) => {
          const today = current[currentDateKey];
          return today ? { ...current, [currentDateKey]: { ...today, totals: remainingMacros(today.totals, food.macros) } } : current;
        });
        failWith(error, true);
      }
    });
  }

  /** What this device still holds from the old local-only version (saved foods only). */
  function readLegacyImport() {
    return legacyToImport(window.localStorage.getItem(recordsKey), currentDateKey);
  }

  async function importLegacyRecords(): Promise<{ imported: number; skippedDays: number } | null> {
    try {
      const result = await track(() => cloudApi.importRecords(readLegacyImport()));
      setLocalImportState("imported");
      void resync(true);
      return { imported: result.imported, skippedDays: result.skippedDays };
    } catch (error) {
      failWith(error);
      return null;
    }
  }

  async function skipLegacyImport(): Promise<boolean> {
    try {
      await track(() => cloudApi.skipImport());
      setLocalImportState("skipped");
      return true;
    } catch (error) {
      failWith(error);
      return false;
    }
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
    localImportState, readLegacyImport, importLegacyRecords, skipLegacyImport,
    cloudMode, cloudError, clearCloudError: () => setCloudError(null), retrySync: () => resync(true), busyFoodIds,
    todayScore: todayMeta?.score ?? null, todayFlows: todayMeta?.flows ?? 0,
    selectedScore: selectedDateKey === currentDateKey ? todayMeta?.score ?? null : selectedMeta?.score ?? null,
    selectedStatus };
}
