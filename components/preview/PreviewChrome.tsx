"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, LogOut, Star, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/lib/i18n";

export type ToolTab = "recognition" | "recommend" | "calendar";
export function usePreviewText() {
  const { language } = useI18n();
  return (zh: string, en: string) => language === "en" ? en : zh;
}
export function Brand() {
  return <span className="inline-flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-3">
    <span className="precision-brand"><span className="precision-brand-mark">F</span><span>Fitness for Everybody<span className="precision-brand-dot">.</span></span></span>
    <span className="brand-credit inline-flex items-baseline gap-1 whitespace-nowrap tracking-normal">
      <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 11, fontWeight: 400, color: "#7b867d" }}>built by</span>
      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontStyle: "italic", fontSize: 13, fontWeight: 600, letterSpacing: "-.035em", color: "#4b7b60" }}>thrqz</span>
    </span>
  </span>;
}
export function PreviewNav({ mode, onStart, onNavigate, onSettings, onFeedback, calendarActive }: {
  mode: "landing" | "workspace"; onStart: () => void;
  onNavigate: (tab: ToolTab) => void; onSettings: () => void;
  onFeedback: () => void; calendarActive: boolean;
}) {
  const text = usePreviewText();
  const { t } = useI18n();
  const auth = useAuth();
  return <nav className="precision-nav" aria-label={t("主要导航")}>
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
      <Link href="/" aria-label="Fitness for Everybody"><Brand /></Link>
      <div className="precision-nav-links hidden lg:flex gap-8 text-sm font-medium text-zinc-500">
        <button onClick={() => onNavigate("recognition")}>{t("食物识别")}</button>
        <button onClick={() => onNavigate("recommend")}>{t("智能推荐下一餐")}</button>
        <button onClick={onFeedback} aria-haspopup="dialog">{text("意见反馈", "Feedback")}</button>
      </div>
      <div className="precision-nav-utilities flex items-center gap-3">
        <LanguageSwitch compact />
        {auth.status === "signed_out" && <button type="button" className="precision-button precision-button--secondary !min-h-[38px] !py-0 !px-4" onClick={auth.openLogin}>{text("登录", "Sign in")}</button>}
        {auth.status === "signed_in" && <span className="precision-auth-chip" title={auth.user?.email ?? undefined}>
          <span className="hidden sm:block">{auth.user?.email}</span>
          <button type="button" className="precision-icon-button" onClick={() => void auth.signOut()} aria-label={text("退出登录", "Sign out")} title={text("退出登录", "Sign out")}><LogOut size={16} /></button>
        </span>}
        {mode === "workspace" && <button id="calendar-access" className={`precision-icon-button ${calendarActive ? "is-active" : ""}`} onClick={() => onNavigate("calendar")} aria-label={t("趋势与日历")} title={t("趋势与日历")} aria-pressed={calendarActive}><CalendarDays size={18} /></button>}
        {mode !== "landing" && <button className="precision-icon-button" title={text("身体信息设置", "Body profile settings")} onClick={onSettings} aria-label={t("打开设置")}><Settings size={18} /></button>}
        <button onClick={onStart} className={`precision-nav-cta ${mode === "workspace" ? "precision-nav-cta--workspace" : ""} bg-zinc-900 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-zinc-800 transition-all shadow-sm`}>{text("开始识别", "Start identifying")}</button>
      </div>
    </div>
  </nav>;
}
export function PrecisionHero({ animated, onStart }: { animated: boolean; onStart: () => void }) {
  const { t } = useI18n();
  const text = usePreviewText();
  return <section className={`precision-hero relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden ${animated ? "precision-hero--animated" : ""}`}>
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12 relative z-10">
      <div className="flex-1 space-y-8 precision-hero-copy">
        <h1 className="text-5xl md:text-7xl font-medium tracking-tighter text-zinc-900 leading-[1.1]">{t("记录生活，")}<br /><span className="text-zinc-400">{t("看懂每一餐。")}</span></h1>
        <p className="text-lg text-zinc-600 max-w-md font-medium">{t("输入食物、品牌和份量，AI 会识别食材并估算这一餐的营养。")}</p>
        <div className="flex gap-4"><button onClick={onStart} className="precision-primary-cta bg-zinc-900 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-zinc-800 transition-all shadow-md flex items-center gap-2">{text("开始识别", "Start identifying")}<ArrowRight size={16} /></button></div>
        <p className="precision-hero-note">{text("不必称重，不必查表。从今天这一餐开始。", "No scales. No spreadsheets. Just start with your next meal.")}</p>
      </div>
      <div className="flex-1 relative w-full aspect-square md:aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl shadow-zinc-200/50 group precision-hero-visual">
        <div className="absolute inset-0 bg-zinc-900/10 group-hover:bg-transparent transition-all duration-500 z-10" />
        <img src="/images/wellness-hero-v2.png" alt={t("摆放着三文鱼、牛油果、蔬菜和谷物的均衡餐")} className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700" fetchPriority="high" />
        <div className="absolute bottom-6 left-6 z-20 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-lg border border-white/20 precision-floating-card">
          <div className="text-sm text-zinc-500 font-medium mb-1">{text("从每一餐开始", "One meal at a time")}</div>
          <div className="text-3xl font-medium tracking-tighter text-zinc-900 flex items-center gap-3">{text("看懂营养", "Eat with clarity")}<ArrowRight size={22} /></div>
        </div>
      </div>
    </div>
  </section>;
}
// Fictional examples for the presentation, never published as real testimonials.
const reviewExamples = [
  { name: "Lime青柠", topicZh: "食物识别", topicEn: "Food recognition",
    bodyZh: "常吃的食物很快就能看到结果。把生熟和克数写清楚，也更方便核对自己实际吃的那一份。", bodyEn: "Common foods return results quickly. Adding the preparation and weight makes it easier to check the portion I actually ate." },
  { name: "Alex R.", topicZh: "营养可视化", topicEn: "Nutrition at a glance",
    bodyZh: "蛋白质、碳水和脂肪都放在同一个页面，进度变化很直观，安排下一餐时心里更有数。", bodyEn: "Protein, carbs and fat share one clear view. The progress bars help me make sense of what to eat next." },
  { name: "阿川 Moves", topicZh: "自定义目标", topicEn: "Personal targets",
    bodyZh: "蛋白质倍数和每日摄入都可以自己调整，热量同步变化，不用再来回手算。", bodyEn: "I can adjust nutrient targets myself and see calories update alongside them, without recalculating everything by hand." },
  { name: "Mika", topicZh: "身体数据适配", topicEn: "Body profile settings",
    bodyZh: "填好身体信息和饮食计划后，再查看推荐摄入和下一餐建议，比套用一个固定目标更方便。", bodyEn: "After setting my body profile and diet plan, I can review intake targets and meal suggestions instead of relying on one fixed goal." }
];

export function Reviews() {
  const text = usePreviewText();
  const rail = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, max: 0 });
  const pendingTarget = useRef<number | null>(null);
  const mouseDrag = useRef<{ pointerId: number; x: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  function syncScroll() {
    const el = rail.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const left = Math.max(0, Math.min(max, el.scrollLeft));
    if (pendingTarget.current !== null && Math.abs(left - pendingTarget.current) <= 3) pendingTarget.current = null;
    setScroll({ left, max });
  }
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      pendingTarget.current = null;
      syncScroll();
    });
    observer.observe(el);
    syncScroll();
    return () => observer.disconnect();
  }, []);
  function move(direction: number) {
    const el = rail.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const first = el.firstElementChild;
    if (!first) return;
    const origin = first.getBoundingClientRect().left;
    const positions = Array.from(new Set([0, ...Array.from(el.children).map(card =>
      Math.max(0, Math.min(max, card.getBoundingClientRect().left - origin))
    ), max])).sort((a, b) => a - b);
    const anchor = pendingTarget.current ?? el.scrollLeft;
    const target = direction > 0
      ? positions.find(position => position > anchor + 3) ?? max
      : positions.slice().reverse().find(position => position < anchor - 3) ?? 0;
    pendingTarget.current = target;
    el.scrollTo({ left: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <section id="reviews" className="precision-reviews py-24 px-6 border-t border-zinc-200/60">
    <style jsx>{`
      .precision-review-rail { scrollbar-width: auto; scrollbar-color: auto; }
      .precision-review-rail::-webkit-scrollbar { height: 8px; }
      .precision-review-rail::-webkit-scrollbar-track { background: #eef0ee; border-radius: 4px; }
      .precision-review-rail::-webkit-scrollbar-thumb { background: #aeb3af; border-radius: 4px; }
    `}</style>
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-end gap-6 mb-12">
        <div><p className="precision-eyebrow">{text("体验示例", "EXPERIENCE PREVIEW")}</p><h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">{text("每一餐，都有自己的故事。", "Every meal has a story.")}</h2></div>
        <div className="flex gap-2 shrink-0"><button className="precision-icon-button" disabled={scroll.left <= 3} aria-label={text("上一张评价", "Previous review")} onClick={() => move(-1)}><ArrowLeft size={18} /></button><button className="precision-icon-button" disabled={scroll.max - scroll.left <= 3} aria-label={text("下一张评价", "Next review")} onClick={() => move(1)}><ArrowRight size={18} /></button></div>
      </div>
      <div ref={rail} className="precision-review-rail"
        tabIndex={0} role="region" aria-label={text("体验示例列表", "Experience examples")}
        style={{ scrollSnapType: "none", paddingBottom: 20, cursor: dragging ? "grabbing" : "grab", userSelect: dragging ? "none" : undefined }}
        onScroll={syncScroll}
        onWheel={() => { pendingTarget.current = null; }}
        onPointerDown={event => {
          pendingTarget.current = null;
          // Only cards use grab-to-scroll. Never capture or reposition the
          // native scrollbar, padding, or touch gestures.
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          if (!(event.target instanceof Element) || !event.target.closest(".precision-review-card")) return;
          const el = event.currentTarget;
          el.scrollTo({ left: el.scrollLeft, behavior: "instant" });
          event.preventDefault();
          mouseDrag.current = { pointerId: event.pointerId, x: event.clientX, left: el.scrollLeft };
          el.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={event => {
          const drag = mouseDrag.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          event.preventDefault();
          event.currentTarget.scrollTo({ left: drag.left - (event.clientX - drag.x), behavior: "instant" });
          syncScroll();
        }}
        onPointerUp={event => {
          mouseDrag.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { mouseDrag.current = null; setDragging(false); }}
        onLostPointerCapture={() => { mouseDrag.current = null; setDragging(false); }}
      >
        {reviewExamples.map((review, item) => <article className="precision-review-card" key={review.name} aria-label={`${text("示例评价", "Sample review")} ${item + 1}`}>
          <div className="flex justify-between items-center gap-3">
            <span className="precision-review-stars" role="img" aria-label={text("示例评分：5星", "Sample rating: 5 stars")}>
              {[0, 1, 2, 3, 4].map(star => <Star key={star} size={15} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />)}
            </span>
          </div>
          <p className="text-base leading-relaxed text-zinc-600 my-8">{text(review.bodyZh, review.bodyEn)}</p>
          <div className="flex items-center gap-3 mt-9 border-t border-zinc-100 pt-6">
            <div className="precision-review-avatar" aria-hidden="true">{review.name.slice(0, 1)}</div>
            <div><p className="text-sm font-medium">{review.name}</p><p className="text-xs text-zinc-400 mt-1">{text(review.topicZh, review.topicEn)}</p></div>
          </div>
        </article>)}
      </div>

    </div>
  </section>;
}
export function PreviewFooter({ onStart, onFeedback }: { onStart?: () => void; onFeedback: () => void }) {
  const text = usePreviewText();
  return <footer className="border-t border-zinc-200/60 bg-white py-12 px-6"><div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <Brand /><div className="flex gap-6 text-xs text-zinc-500 font-medium"><Link href="/">{text("首页", "Home")}</Link>{onStart && <button onClick={onStart}>{text("开始识别", "Start identifying")}</button>}<button onClick={onFeedback} aria-haspopup="dialog">{text("意见反馈", "Feedback")}</button></div>
  </div></footer>;
}
