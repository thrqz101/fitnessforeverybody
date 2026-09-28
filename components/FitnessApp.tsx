"use client";

import { Activity, BarChart3, Camera, ChefHat, Settings, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ProfilePanel } from "@/components/ProfilePanel";
import { Recommendations } from "@/components/Recommendations";
import { TrainingCalendar } from "@/components/TrainingCalendar";
import { useFitnessState } from "@/lib/use-fitness-state";
import { useI18n } from "@/lib/i18n";
import { goalLabels } from "@/lib/nutrition";
import type { DayState, FoodLogItem, UserProfile } from "@/lib/types";

type View = "calendar" | "dashboard" | "recommend" | "settings";
type MainView = Exclude<View, "settings">;

export function FitnessApp() {
  const { t } = useI18n();
  const state = useFitnessState();
  const { profile, day, foods, records, currentDateKey, selectedDateKey, hasProfile, hydrated,
    topUpPromptOpen, setTopUpPromptOpen, setDay, setSelectedDateKey, targets, totals, gaps,
    selectedDay, selectedFoods, selectedTargets, selectedTotals, todayLabel,
    removeFood, saveFoodToCalendar, clearDraftFoods } = state;
  const [view, setView] = useState<View>("dashboard");
  const [lastMainView, setLastMainView] = useState<MainView>("dashboard");

  useEffect(() => {
    if (hydrated) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [hydrated, view]);

  function completeProfile(nextProfile: UserProfile, nextDay: DayState) {
    state.completeProfile(nextProfile, nextDay);
    setView("dashboard");
  }
  function openSettings() {
    if (view !== "settings") setLastMainView(view);
    setView("settings");
  }
  function addFoods(newFoods: FoodLogItem[]) {
    state.addFoods(newFoods);
    setView("dashboard");
  }
  function chooseRecommendation(food: FoodLogItem) {
    state.chooseRecommendation(food);
    setView("dashboard");
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
