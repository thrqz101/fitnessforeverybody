"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, MessageSquare, ScanLine } from "lucide-react";
import { Dashboard } from "@/components/Dashboard";
import { ProfilePanel } from "@/components/ProfilePanel";
import { Recommendations } from "@/components/Recommendations";
import { TrainingCalendar } from "@/components/TrainingCalendar";
import { useI18n } from "@/lib/i18n";
import { useFitnessState } from "@/lib/use-fitness-state";
import { PrecisionHero, PreviewFooter, PreviewNav, Reviews, usePreviewText, type ToolTab } from "./PreviewChrome";
import { Feedback } from "./Feedback";
import { PreviewDialog } from "./PreviewDialog";

const FitnessContext = createContext<ReturnType<typeof useFitnessState> | null>(null);
export function PreviewProvider({ children }: { children: ReactNode }) {
  const state = useFitnessState(true);
  return <FitnessContext.Provider value={state}><div className="precision-preview">{children}</div></FitnessContext.Provider>;
}

export function PreviewApp({ mode }: { mode: "landing" | "workspace" }) {
  const state = useContext(FitnessContext)!;
  const { t } = useI18n();
  const text = usePreviewText();
  const router = useRouter();
  const [tab, setTab] = useState<ToolTab>("recognition");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackInvitation, setFeedbackInvitation] = useState<number | null>(null);
  const initialViewApplied = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<ToolTab | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ target: ToolTab; records?: boolean } | null>(null);
  const visited = useRef(new Set<ToolTab>(["recognition"]));
  const labels: Record<ToolTab, string> = {
    recognition: t("识别与记录"),
    recommend: t("聪明吃什么"), calendar: t("趋势与日历")
  };

  const primaryViews: ToolTab[] = ["recognition", "recommend"];

  function openFeedback(invitation: number | null = null) {
    if (state.feedbackMilestone) state.acknowledgeFeedbackInvitation(state.feedbackMilestone);
    setFeedbackInvitation(invitation);
    setFeedbackOpen(true);
  }

  useEffect(() => {
    if (!state.hydrated || mode !== "workspace" || initialViewApplied.current) return;
    initialViewApplied.current = true;
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested !== "recommend" && requested !== "calendar") return;
    navigate(requested);
  }, [mode, state.hydrated]);

  useEffect(() => {
    const milestone = state.feedbackMilestone;
    if (!state.hydrated || !state.hasProfile || mode !== "workspace" || !milestone || feedbackOpen || settingsOpen || state.topUpPromptOpen) return;
    const timer = window.setInterval(() => {
      // Wait until other dialogs and active typing have finished; never stack invitations.
      if (document.visibilityState !== "visible" || document.querySelector('dialog[open], [aria-modal="true"]')) return;
      if (document.activeElement?.matches("input,textarea,select,[contenteditable=true]")) return;
      state.acknowledgeFeedbackInvitation(milestone);
      setFeedbackInvitation(milestone);
      setFeedbackOpen(true);
    }, 800);
    return () => window.clearInterval(timer);
  }, [state.hydrated, state.hasProfile, state.feedbackMilestone, mode, feedbackOpen, settingsOpen, state.topUpPromptOpen]);

  useEffect(() => {
    if (!focusRequest || settingsOpen || !state.hasProfile) return;
    const frame = requestAnimationFrame(() => {
      const target = focusRequest.records ? document.querySelector(".precision-preview .meal-timeline") : document.getElementById(focusRequest.target);
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      if (focusRequest.target === "recognition" && !focusRequest.records) {
        document.querySelector<HTMLTextAreaElement>(".precision-preview .food-composer textarea")?.focus({ preventScroll: true });
      } else if (target instanceof HTMLElement) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, settingsOpen, state.hasProfile]);

  function navigate(nextTab: ToolTab, records = false) {
    if (!state.hydrated) return;
    if (mode === "landing") {
      if (!state.hasProfile) { setPendingTab(nextTab); setSettingsOpen(true); }
      else router.push(nextTab === "recognition" ? "/workspace" : `/workspace?view=${nextTab}`);
      return;
    }
    if (!state.hasProfile) { setPendingTab(nextTab); setSettingsOpen(true); return; }
    visited.current.add(nextTab);
    setTab(nextTab);
    setFocusRequest({ target: nextTab, records });
  }


  return <>
    <PreviewNav mode={mode} onStart={() => navigate("recognition")} onNavigate={navigate} calendarActive={tab === "calendar"} onFeedback={() => openFeedback()} onSettings={() => { setPendingTab(null); setSettingsOpen(true); }} />
    <main>
      {mode === "landing" && <PrecisionHero animated onStart={() => navigate("recognition")} />}
      {mode === "workspace" && <div className="precision-tools precision-tools--workspace max-w-7xl mx-auto px-6">
        <div className="precision-tools-heading"><div><p className="precision-eyebrow">{text("你的每日营养空间", "YOUR DAILY NUTRITION SPACE")}</p><h2>{tab === "calendar" ? t("趋势与日历") : text("今天，吃得更明白。", "A little more clarity, every day.")}</h2></div><span className="precision-free-label">{text("全部功能，完全免费", "Every feature. Completely free.")}</span></div>
        <nav className="precision-tabs" aria-label={text("主要功能", "Main tools")}>
          {primaryViews.map((key) => <button key={key} id={`tab-${key}`} aria-current={tab === key ? "page" : undefined} className={tab === key ? "is-active" : ""} onClick={() => navigate(key)}>{labels[key]}</button>)}
          <button onClick={() => openFeedback()} aria-haspopup="dialog" className="precision-feedback-action"><MessageSquare size={15} />{text("给我反馈", "Give feedback")}</button>
        </nav>
        {!state.hydrated ? <p className="py-20 text-center text-zinc-500">{t("正在准备你的健康空间")}</p> : !state.hasProfile ? <div className="precision-locked-tools">
          {[tab].map((key, index) => <section id={key} key={key} className="precision-locked-card"><div className="precision-locked-icon">{key === "recognition" ? <ScanLine size={26} /> : <LockKeyhole size={22} />}</div><span className="precision-eyebrow">0{index + 1} / {labels[key]}</span><h3>{key === "recognition" ? t("输入食物、品牌和份量，AI 会识别食材并估算这一餐的营养。") : labels[key]}</h3><p>{text("先填写身体资料，再查看属于你的营养目标与记录。", "Set up your profile to see your personal targets and records.")}</p><button className="precision-button" onClick={() => navigate(key)}>{key === "recognition" ? text("开始识别", "Start identifying") : text("填写资料", "Set up profile")}<ArrowRight size={16} /></button></section>)}
        </div> : <div className="precision-tool-content">
          <div hidden={tab !== "recognition"}>
            <Dashboard presentation="workspace"
              profile={state.profile} day={state.day} targets={state.targets} totals={state.totals} gaps={state.gaps} foods={state.foods} todayLabel={state.todayLabel}
              onNavigate={(view) => view === "settings" ? setSettingsOpen(true) : navigate(view)}
              onDayChange={state.setDay} onAddFoods={(foods) => { state.addFoods(foods); navigate("recognition", true); }}
              onRemoveFood={state.removeFood} onSaveFood={state.saveFoodToCalendar} onClearDrafts={state.clearDraftFoods} />
          </div>
          {visited.current.has("recommend") && <section id="recommend" role="region" aria-labelledby="tab-recommend" aria-label={labels.recommend} hidden={tab !== "recommend"} className="precision-functional-section">
            <Recommendations preview portalTarget={document.querySelector(".precision-preview")} profile={state.profile} day={state.day} gaps={state.gaps} targets={state.targets} totals={state.totals} foods={state.savedFoods}
              onChoose={(food) => { state.chooseRecommendation(food); navigate("recognition", true); }} onRecognizeRequested={() => navigate("recognition")} />
          </section>}
          {visited.current.has("calendar") && <section id="calendar" role="region" aria-labelledby="calendar-access" aria-label={labels.calendar} hidden={tab !== "calendar"} className="precision-functional-section">
            <TrainingCalendar profile={state.profile} day={state.selectedDay} foods={state.selectedFoods} records={state.records} currentDateKey={state.currentDateKey}
              selectedDateKey={state.selectedDateKey} onSelectDate={state.setSelectedDateKey} targets={state.selectedTargets} totals={state.selectedTotals} todayLabel={state.todayLabel}
              onDayChange={state.selectedDateKey === state.currentDateKey ? state.setDay : undefined} />
          </section>}
        </div>}
      </div>}
      {mode === "landing" && <Reviews />}
    </main>
    <PreviewFooter onStart={() => navigate("recognition")} onFeedback={() => openFeedback()} />
    {feedbackOpen && <Feedback invitation={feedbackInvitation} onClose={() => setFeedbackOpen(false)} />}
    {settingsOpen && <PreviewDialog title={t("本地系统设置")} wide onClose={() => { setSettingsOpen(false); setPendingTab(null); }}>
      <ProfilePanel profile={state.profile} day={state.day} onBack={() => { setSettingsOpen(false); setPendingTab(null); }} onSave={(profile, day) => {
        state.completeProfile(profile, day); setSettingsOpen(false);
        if (mode === "landing" && pendingTab) router.push(pendingTab === "recognition" ? "/workspace" : `/workspace?view=${pendingTab}`);
        else if (pendingTab) { visited.current.add(pendingTab); setTab(pendingTab); setFocusRequest({ target: pendingTab }); }
        setPendingTab(null);
      }} />
    </PreviewDialog>}
    {state.topUpPromptOpen && <PreviewDialog title={t("今天距离营养达标还差一点噢")} onClose={() => state.setTopUpPromptOpen(false)}>
      <p className="text-xs tracking-widest text-zinc-400 mb-3">Snack Check</p><p className="text-sm text-zinc-500 leading-7">{t("要不要加个餐补一补？我可以推荐水果、零食、健身补剂或者夜宵，就看你有多饿了～")}</p>
      <div className="flex flex-wrap gap-3 mt-6"><button className="precision-button" onClick={() => { state.setTopUpPromptOpen(false); navigate("recommend"); }}>{t("看加餐推荐")}</button><button className="precision-button precision-button--secondary" onClick={() => { state.setTopUpPromptOpen(false); navigate("recognition"); }}>{t("再识别一餐")}</button><button className="precision-button precision-button--secondary" onClick={() => state.setTopUpPromptOpen(false)}>{t("今天先这样")}</button></div>
    </PreviewDialog>}
  </>;
}
