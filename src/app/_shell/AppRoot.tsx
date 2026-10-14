"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, MessageSquare, ScanLine } from "lucide-react";
import { Dashboard } from "@/features/daily-log/ui/Dashboard";
import { ProfilePanel } from "@/features/profile/ui/ProfilePanel";
import { Recommendations } from "@/features/recommendation/ui/Recommendations";
import { TrainingCalendar } from "@/features/daily-log/ui/TrainingCalendar";
import { AccountDialog } from "@/features/account/ui/AccountDialog";
import { ImportDialog } from "@/features/account/ui/ImportDialog";
import { LoginDialog } from "@/features/account/ui/LoginDialog";
import { useAuth } from "@/shared/auth/AuthProvider";
import { useI18n, useText } from "@/shared/i18n/i18n";
import { useFitnessState } from "@/features/daily-log/state/use-fitness-state";
import { PrecisionHero, SiteFooter, SiteNav, Reviews, type ToolTab } from "./AppShell";
import { Feedback } from "@/features/feedback/ui/Feedback";
import { Dialog } from "@/shared/ui/Dialog";

const FitnessContext = createContext<ReturnType<typeof useFitnessState> | null>(null);
export function AppProviders({ children }: { children: ReactNode }) {
  const state = useFitnessState(true);
  return <FitnessContext.Provider value={state}><div className="precision-preview">{children}</div></FitnessContext.Provider>;
}

export function AppRoot({ mode }: { mode: "landing" | "workspace" }) {
  const state = useContext(FitnessContext)!;
  const { t } = useI18n();
  const text = useText();
  const router = useRouter();
  const auth = useAuth();
  const [loginIntent, setLoginIntent] = useState<ToolTab | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [legacyImport, setLegacyImport] = useState<{ days: number; foods: number } | null>(null);
  const importDeferred = useRef(false);
  const [tab, setTab] = useState<ToolTab>("recognition");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackInvitation, setFeedbackInvitation] = useState<number | null>(null);
  const initialViewApplied = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<ToolTab | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ target: ToolTab; records?: boolean } | null>(null);
  const visited = useRef(new Set<ToolTab>(["recognition"]));
  const labels: Record<ToolTab, string> = {
    recognition: t("食物识别"),
    recommend: t("智能推荐下一餐"), calendar: t("趋势与日历")
  };

  const primaryViews: ToolTab[] = ["recognition", "recommend"];

  function openFeedback(invitation: number | null = null) {
    if (auth.status === "loading") return;
    if (auth.status === "signed_out") { auth.openLogin(); return; }
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

  useEffect(() => {
    // Offer the one-time import after the profile exists (today's goal snapshot is needed for today's records).
    if (!state.cloudMode || !state.hydrated || !state.hasProfile || state.localImportState !== "pending" || importDeferred.current) return;
    const found = state.readLegacyImport();
    if (found.foodCount > 0) setLegacyImport({ days: found.dayCount, foods: found.foodCount });
  }, [state.cloudMode, state.hydrated, state.hasProfile, state.localImportState]);

  useEffect(() => {
    if (auth.status !== "signed_in" || !loginIntent) return;
    const intent = loginIntent;
    setLoginIntent(null);
    navigate(intent);
  }, [auth.status, loginIntent, state.hydrated]);

  function navigate(nextTab: ToolTab, records = false) {
    if (auth.status === "loading") return;
    if (auth.status === "signed_out") { setLoginIntent(nextTab); auth.openLogin(); return; }
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
    <SiteNav mode={mode} onStart={() => navigate("recognition")} onNavigate={navigate} calendarActive={tab === "calendar"} onFeedback={() => openFeedback()} onSettings={() => { setPendingTab(null); setSettingsOpen(true); }} />
    {state.cloudError && <div role="alert" className="precision-cloud-alert">
      <span>{state.cloudError}</span>
      <span className="flex gap-2">
        {!state.hydrated && <button type="button" onClick={() => void state.retrySync()}>{text("重试", "Retry")}</button>}
        <button type="button" onClick={state.clearCloudError} aria-label={text("关闭提示", "Dismiss")}>{text("知道了", "Dismiss")}</button>
      </span>
    </div>}
    <main>
      {mode === "landing" && <PrecisionHero animated onStart={() => navigate("recognition")} />}
      {mode === "workspace" && <div className="precision-tools precision-tools--workspace max-w-7xl mx-auto px-6">
        <div className="precision-tools-heading"><div><p className="precision-eyebrow">{text("你的每日营养空间", "YOUR DAILY NUTRITION SPACE")}</p><h2>{tab === "calendar" ? t("趋势与日历") : text("今天，吃得更明白。", "A little more clarity, every day.")}</h2></div><span className="precision-free-label">{text("全部功能，完全免费", "Every feature. Completely free.")}</span></div>
        <nav className="precision-tabs" aria-label={text("主要功能", "Main tools")}>
          {primaryViews.map((key) => <button key={key} id={`tab-${key}`} aria-current={tab === key ? "page" : undefined} className={tab === key ? "is-active" : ""} onClick={() => navigate(key)}>{labels[key]}</button>)}
          <button onClick={() => openFeedback()} aria-haspopup="dialog" className="precision-feedback-action"><MessageSquare size={15} />{text("意见反馈", "Feedback")}</button>
        </nav>
        {auth.status === "signed_out" ? <div className="precision-locked-tools">
          <section id={tab} className="precision-locked-card"><div className="precision-locked-icon"><LockKeyhole size={22} /></div><span className="precision-eyebrow">{text("需要登录", "SIGN IN REQUIRED")}</span><h3>{text("登录后使用识别、记录和反馈", "Sign in to use recognition, records and feedback")}</h3><p>{text("用邮箱验证码登录，无需密码，数据会保存到你的账号。", "Sign in with an emailed code. No password needed, and your data is saved to your account.")}</p><button className="precision-button" onClick={auth.openLogin}>{text("登录", "Sign in")}<ArrowRight size={16} /></button></section>
        </div> : !state.hydrated || auth.status === "loading" ? <p className="py-20 text-center text-zinc-500">{t("正在准备你的健康空间")}</p> : !state.hasProfile ? <div className="precision-locked-tools">
          {[tab].map((key, index) => <section id={key} key={key} className="precision-locked-card"><div className="precision-locked-icon">{key === "recognition" ? <ScanLine size={26} /> : <LockKeyhole size={22} />}</div><span className="precision-eyebrow">0{index + 1} / {labels[key]}</span><h3>{key === "recognition" ? t("输入食物、品牌和份量，AI 会识别食材并估算这一餐的营养。") : labels[key]}</h3><p>{text("先填写身体资料，再查看属于你的营养目标与记录。", "Set up your profile to see your personal targets and records.")}</p><button className="precision-button" onClick={() => navigate(key)}>{key === "recognition" ? text("开始识别", "Start identifying") : text("填写资料", "Set up profile")}<ArrowRight size={16} /></button></section>)}
        </div> : <div className="precision-tool-content">
          <div hidden={tab !== "recognition"}>
            <Dashboard presentation="workspace"
              profile={state.profile} day={state.day} targets={state.targets} totals={state.totals} gaps={state.gaps} foods={state.foods} todayLabel={state.todayLabel}
              onNavigate={(view) => view === "settings" ? setSettingsOpen(true) : navigate(view)}
              onDayChange={state.setDay} onAddFoods={(foods) => { state.addFoods(foods); navigate("recognition", true); }}
              onRemoveFood={state.removeFood} onSaveFood={state.saveFoodToCalendar} onClearDrafts={state.clearDraftFoods} onClearAll={state.clearAllFoods}
              score={state.todayScore} busyFoodIds={state.busyFoodIds} allowDeleteSaved={state.cloudMode} />
          </div>
          {visited.current.has("recommend") && <section id="recommend" role="region" aria-labelledby="tab-recommend" aria-label={labels.recommend} hidden={tab !== "recommend"} className="precision-functional-section">
            <Recommendations preview portalTarget={document.querySelector(".precision-preview")} profile={state.profile} day={state.day} gaps={state.gaps} targets={state.targets} totals={state.totals} foods={state.savedFoods}
              onChoose={(food) => { state.chooseRecommendation(food); navigate("recognition", true); }} onRecognizeRequested={() => navigate("recognition")} />
          </section>}
          {visited.current.has("calendar") && <section id="calendar" role="region" aria-labelledby="calendar-access" aria-label={labels.calendar} hidden={tab !== "calendar"} className="precision-functional-section">
            <TrainingCalendar profile={state.profile} day={state.selectedDay} foods={state.selectedFoods} records={state.records} currentDateKey={state.currentDateKey}
              selectedDateKey={state.selectedDateKey} onSelectDate={state.setSelectedDateKey} targets={state.selectedTargets} totals={state.selectedTotals} todayLabel={state.todayLabel}
              onDayChange={state.selectedDateKey === state.currentDateKey ? state.setDay : undefined}
              score={state.cloudMode ? state.selectedScore : undefined} status={state.selectedStatus} />
          </section>}
        </div>}
      </div>}
      {mode === "landing" && <Reviews />}
    </main>
    <SiteFooter onStart={() => navigate("recognition")} onFeedback={() => openFeedback()} onAccount={auth.status === "signed_in" ? () => setAccountOpen(true) : undefined} />
    {feedbackOpen && <Feedback invitation={feedbackInvitation} onClose={() => setFeedbackOpen(false)} />}
    {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}
    {legacyImport && <ImportDialog days={legacyImport.days} foods={legacyImport.foods}
      onImport={state.importLegacyRecords}
      onSkip={async () => { const ok = await state.skipLegacyImport(); if (ok) setLegacyImport(null); return ok; }}
      onLater={() => { importDeferred.current = true; setLegacyImport(null); }} />}
    {auth.loginOpen && <LoginDialog onClose={() => { auth.closeLogin(); setLoginIntent(null); }} />}
    {settingsOpen && <Dialog title={t("本地系统设置")} wide onClose={() => { setSettingsOpen(false); setPendingTab(null); }}>
      <ProfilePanel profile={state.profile} day={state.day} onBack={() => { setSettingsOpen(false); setPendingTab(null); }} onSave={async (profile, day) => {
        if (!await state.completeProfile(profile, day)) return;
        setSettingsOpen(false);
        if (mode === "landing" && pendingTab) router.push(pendingTab === "recognition" ? "/workspace" : `/workspace?view=${pendingTab}`);
        else if (pendingTab) { visited.current.add(pendingTab); setTab(pendingTab); setFocusRequest({ target: pendingTab }); }
        setPendingTab(null);
      }} />
    </Dialog>}
    {state.topUpPromptOpen && <Dialog title={t("今天距离营养达标还差一点噢")} onClose={() => state.setTopUpPromptOpen(false)}>
      <p className="text-xs tracking-widest text-zinc-400 mb-3">Snack Check</p><p className="text-sm text-zinc-500 leading-7">{t("要不要加个餐补一补？我可以推荐水果、零食、健身补剂或者夜宵，就看你有多饿了～")}</p>
      <div className="flex flex-wrap gap-3 mt-6"><button className="precision-button" onClick={() => { state.setTopUpPromptOpen(false); navigate("recommend"); }}>{t("看加餐推荐")}</button><button className="precision-button precision-button--secondary" onClick={() => { state.setTopUpPromptOpen(false); navigate("recognition"); }}>{t("再识别一餐")}</button><button className="precision-button precision-button--secondary" onClick={() => state.setTopUpPromptOpen(false)}>{t("今天先这样")}</button></div>
    </Dialog>}
  </>;
}
