"use client";

import { Activity, BarChart3, Camera, ChefHat, Settings, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ProfilePanel } from "@/components/ProfilePanel";
import { Recommendations } from "@/components/Recommendations";
import { TrainingCalendar } from "@/components/TrainingCalendar";
import { getBeijingDateKey } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import { calculateRecommendedFiberGrams, calculateRecommendedMacroMultipliers, calculateTargets, defaultDayState, defaultProfile, goalLabels, hasMeaningfulGap, normalizeFiberGrams, normalizeMacroMultipliers, remainingMacros, sumFoods } from "@/lib/nutrition";
import type { DayRecord, DayState, FoodLogItem, UserProfile } from "@/lib/types";

type View = "calendar" | "dashboard" | "recommend" | "settings";
type MainView = Exclude<View, "settings">;

const profileKey = "ffe-profile";
const dayKey = "ffe-day";
const foodsKey = "ffe-foods";
const recordsKey = "ffe-day-records";

export function FitnessApp() {
  const { t, language } = useI18n();
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [day, setDay] = useState<DayState>(defaultDayState);
  const [foods, setFoods] = useState<FoodLogItem[]>([]);
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [currentDateKey, setCurrentDateKey] = useState(getBeijingDateKey());
  const [selectedDateKey, setSelectedDateKey] = useState(getBeijingDateKey());
  const [hasProfile, setHasProfile] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [lastMainView, setLastMainView] = useState<MainView>("dashboard");
  const [topUpPromptOpen, setTopUpPromptOpen] = useState(false);

  useEffect(() => {
    const today = getBeijingDateKey();
    const storedProfile = window.localStorage.getItem(profileKey);
    const storedDay = window.localStorage.getItem(dayKey);
    const storedFoods = window.localStorage.getItem(foodsKey);
    const storedRecords = window.localStorage.getItem(recordsKey);
    const parsedRecords = storedRecords ? parseRecords(storedRecords) : {};

    if (storedProfile) {
      setProfile(normalizeProfile(JSON.parse(storedProfile) as Partial<UserProfile>));
      setHasProfile(true);
    } else {
      setView("settings");
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
    if (!hydrated) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [hydrated, view]);

  const savedFoods = useMemo(() => foods.filter((food) => food.savedToCalendar), [foods]);

  useEffect(() => {
    if (!hydrated) return;
    setRecords((current) => ({
      ...current,
      [currentDateKey]: {
        dateKey: currentDateKey,
        day,
        foods: savedFoods
      }
    }));
  }, [currentDateKey, day, hydrated, savedFoods]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(recordsKey, JSON.stringify(records));
  }, [hydrated, records]);

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
    setView("dashboard");
  }

  function openSettings() {
    if (view !== "settings") setLastMainView(view);
    setView("settings");
  }

  function addFoods(newFoods: FoodLogItem[]) {
    setFoods((current) => [...newFoods.map(markFoodAsDraft), ...current]);
    setView("dashboard");
  }

  function chooseRecommendation(food: FoodLogItem) {
    const afterChoiceGaps = remainingMacros(gaps, food.macros);
    setFoods((current) => [markFoodAsDraft(food), ...current]);
    setTopUpPromptOpen(hasMeaningfulGap(afterChoiceGaps));
    setView("dashboard");
  }

  function removeFood(id: string) {
    setFoods((current) => current.filter((food) => food.id !== id || food.savedToCalendar));
  }

  function saveFoodToCalendar(id: string) {
    setFoods((current) =>
      current.map((food) => (food.id === id ? { ...food, savedToCalendar: true } : food))
    );
  }

  function clearDraftFoods() {
    setFoods((current) => current.filter((food) => food.savedToCalendar));
  }

  if (!hydrated) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="wellness-card relative z-10 p-8 text-center">
          <div className="brand-mark mx-auto">
            <Activity className="animate-pulse" size={24} aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-black text-ink/65">{t("正在准备你的健康空间")}</p>
        </div>
      </main>
    );
  }

  if (!hasProfile || view === "settings") {
    return <ProfilePanel profile={profile} day={day} onSave={completeProfile} onBack={hasProfile ? () => setView(lastMainView) : undefined} />;
  }

  return (
    <main className="wellness-app">
      <aside className="wellness-sidebar">
        <div className="wellness-brand">
          <div className="wellness-brand__mark"><BrandLogo /></div>
          <div className="wellness-brand__copy"><strong>Fitness for Everybody</strong><span>AI nutrition guide</span></div>
        </div>

        <nav className="wellness-nav" aria-label={t("主要导航")}>
          <NavButton active={view === "dashboard"} icon={<Camera size={19} aria-hidden="true" />} label={t("今天")} hint={t("识别与记录")} onClick={() => setView("dashboard")} />
          <NavButton active={view === "calendar"} icon={<BarChart3 size={19} aria-hidden="true" />} label={t("进度")} hint={t("趋势与日历")} onClick={() => setView("calendar")} />
          <NavButton active={view === "recommend"} icon={<ChefHat size={19} aria-hidden="true" />} label={t("灵感")} hint={t("聪明吃什么")} onClick={() => setView("recommend")} />
          <NavButton active={false} icon={<Settings size={19} aria-hidden="true" />} label={t("设置")} hint={t("调整目标")} onClick={openSettings} />
        </nav>

        <div className="sidebar-insight">
          <span><Sparkles size={14} /> {t("今日节奏")}</span>
          <strong>{day.isTrainingDay ? t("训练日") : t("恢复日")}</strong>
          <p>{t(goalLabels[profile.goal])} · {t("还可摄入 {count} kcal", { count: Math.max(0, Math.round(gaps.calories)) })}</p>
        </div>

        <div className="sidebar-profile">
          <div>N</div>
          <span><strong>{t("你的健康计划")}</strong><small>{t(profile.trainingStyle)}</small></span>
        </div>

        <div className="px-4 pb-4">
          <LanguageSwitch />
        </div>
      </aside>

      <section className="wellness-main">
        <header className="mobile-wellness-header">
          <div className="wellness-brand">
            <div className="wellness-brand__mark"><BrandLogo /></div>
            <div className="wellness-brand__copy"><strong>Fitness for Everybody</strong><span>AI nutrition guide</span></div>
          </div>
          <LanguageSwitch compact />
          <button type="button" onClick={openSettings} aria-label={t("打开设置")}><Settings size={20} /></button>
        </header>

        <div key={view} className="view-stage">
        {view === "calendar" ? (
          <TrainingCalendar
            profile={profile}
            day={selectedDay}
            foods={selectedFoods}
            records={records}
            currentDateKey={currentDateKey}
            selectedDateKey={selectedDateKey}
            onSelectDate={setSelectedDateKey}
            targets={selectedTargets}
            totals={selectedTotals}
            todayLabel={todayLabel}
            onDayChange={selectedDateKey === currentDateKey ? setDay : undefined}
          />
        ) : null}

        {view === "dashboard" ? (
          <Dashboard
            profile={profile}
            day={day}
            targets={targets}
            totals={totals}
            gaps={gaps}
            foods={foods}
            todayLabel={todayLabel}
            onNavigate={setView}
            onDayChange={setDay}
            onAddFoods={addFoods}
            onRemoveFood={removeFood}
            onSaveFood={saveFoodToCalendar}
            onClearDrafts={clearDraftFoods}
          />
        ) : null}

        {view === "recommend" ? (
          <Recommendations
            profile={profile}
            day={day}
            gaps={gaps}
            targets={targets}
            totals={totals}
            foods={foods}
            onChoose={chooseRecommendation}
            onRecognizeRequested={() => setView("dashboard")}
          />
        ) : null}
        </div>

        {topUpPromptOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4 backdrop-blur-sm">
            <section className="wellness-card w-full max-w-lg p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Snack Check</p>
              <h2 className="mt-2 text-2xl font-black text-ink">{t("今天距离营养达标还差一点噢")}</h2>
              <p className="mt-3 text-sm leading-6 text-ink/62">
                {t("要不要加个餐补一补？我可以推荐水果、零食、健身补剂或者夜宵，就看你有多饿了～")}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setTopUpPromptOpen(false);
                    setView("recommend");
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-[18px] bg-moss px-3 text-sm font-black text-white"
                >
                  {t("看加餐推荐")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTopUpPromptOpen(false);
                    setView("dashboard");
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-[18px] bg-coral px-3 text-sm font-black text-white"
                >
                  {t("再识别一餐")}
                </button>
                <button
                  type="button"
                  onClick={() => setTopUpPromptOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-ink/12 bg-paper px-3 text-sm font-black text-ink"
                >
                  {t("今天先这样")}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
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
    savedToCalendar: food.savedToCalendar ?? true
  }));
}

function markFoodAsDraft(food: FoodLogItem): FoodLogItem {
  return {
    ...food,
    savedToCalendar: false
  };
}


function NavButton({
  active,
  icon,
  hint,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  hint: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`wellness-nav__item ${active ? "is-active" : ""}`}
    >
      <span className="wellness-nav__icon">{icon}</span>
      <span className="wellness-nav__copy"><strong>{label}</strong><small>{hint}</small></span>
    </button>
  );
}

function BrandLogo() {
  return (
    <img src="/images/fitness-for-everybody-mark.png" alt="" aria-hidden="true" />
  );
}
