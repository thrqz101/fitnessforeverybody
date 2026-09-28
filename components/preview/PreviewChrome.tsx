"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Quote, Settings } from "lucide-react";
import { useRef, useState } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useI18n } from "@/lib/i18n";

export type ToolTab = "recognition" | "recommend" | "calendar";
export function usePreviewText() {
  const { language } = useI18n();
  return (zh: string, en: string) => language === "en" ? en : zh;
}
export function Brand() {
  return <span className="precision-brand"><span className="precision-brand-mark">F</span><span>Fitness for Everybody<span className="precision-brand-dot">.</span></span></span>;
}
export function PreviewNav({ mode, onStart, onNavigate, onSettings, onFeedback, calendarActive }: {
  mode: "landing" | "workspace"; onStart: () => void;
  onNavigate: (tab: ToolTab) => void; onSettings: () => void;
  onFeedback: () => void; calendarActive: boolean;
}) {
  const text = usePreviewText();
  const { t } = useI18n();
  return <nav className="precision-nav" aria-label={t("主要导航")}>
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
      <Link href="/" aria-label="Fitness for Everybody"><Brand /></Link>
      <div className="precision-nav-links hidden lg:flex gap-8 text-sm font-medium text-zinc-500">
        <button onClick={() => onNavigate("recognition")}>{t("识别与记录")}</button>
        <button onClick={() => onNavigate("recommend")}>{t("聪明吃什么")}</button>
        <button onClick={onFeedback} aria-haspopup="dialog">{text("给我反馈", "Give feedback")}</button>
      </div>
      <div className="precision-nav-utilities flex items-center gap-3">
        <LanguageSwitch compact />
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-600">
          <span className="w-2 h-2 rounded-full bg-green-500" />{text("完全免费 · 为每一个你", "Completely free · For everybody")}
        </div>
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
export function Reviews() {
  const text = usePreviewText();
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  function move(direction: number) {
    const el = rail.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    el.scrollBy({ left: direction * ((card?.offsetWidth ?? 320) + 24), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  return <section id="reviews" className="precision-reviews py-24 px-6 border-t border-zinc-200/60">
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-end gap-6 mb-12">
        <div><p className="precision-eyebrow">{text("用户评价", "FROM THE COMMUNITY")}</p><h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4">{text("每一餐，都有自己的故事。", "Every meal has a story.")}</h2><p className="text-sm text-zinc-500">{text("评价展示区 · 以下为排版占位，真实评价待补充。", "Preview only · These are layout placeholders, not real testimonials.")}</p></div>
        <div className="flex gap-2 shrink-0"><button className="precision-icon-button" disabled={index === 0} aria-label={text("上一张评价", "Previous review")} onClick={() => move(-1)}><ArrowLeft size={18} /></button><button className="precision-icon-button" disabled={atEnd} aria-label={text("下一张评价", "Next review")} onClick={() => move(1)}><ArrowRight size={18} /></button></div>
      </div>
      <div ref={rail} className="precision-review-rail" onScroll={(event) => { const el = event.currentTarget; setIndex(Math.round(el.scrollLeft / ((el.firstElementChild as HTMLElement).offsetWidth + 24))); setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2); }}>
        {[0, 1, 2, 3].map((item) => <article className="precision-review-card" key={item} aria-label={`${text("评价占位", "Review placeholder")} ${item + 1}`}>
          <div className="flex justify-between items-center"><Quote size={28} strokeWidth={1} className="text-zinc-400" /><span className="text-[10px] tracking-widest text-zinc-400 uppercase">{text("排版占位", "PLACEHOLDER")} / 0{item + 1}</span></div>
          <p className="text-xl font-medium leading-relaxed tracking-tight my-8">{text("这里将展示一位用户的真实体验。", "A real experience will live here.")}</p>
          <p className="text-sm leading-relaxed text-zinc-500">{text("收到允许公开的评价后，将原文放在这里。", "Once a user approves sharing their feedback, their original words will appear here.")}</p>
          <div className="flex items-center gap-3 mt-9 border-t border-zinc-100 pt-6"><div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">—</div><div><p className="text-sm font-medium">{text("用户昵称待补充", "Name to come")}</p><p className="text-xs text-zinc-400 mt-1">{text("尚无公开评价", "No published review yet")}</p></div></div>
        </article>)}
      </div>
    </div>
  </section>;
}
export function PreviewFooter({ onStart, onFeedback }: { onStart?: () => void; onFeedback: () => void }) {
  const text = usePreviewText();
  return <footer className="border-t border-zinc-200/60 bg-white py-12 px-6"><div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
    <Brand /><div className="flex gap-6 text-xs text-zinc-500 font-medium"><Link href="/">{text("首页", "Home")}</Link>{onStart && <button onClick={onStart}>{text("开始识别", "Start identifying")}</button>}<button onClick={onFeedback} aria-haspopup="dialog">{text("给我反馈", "Give feedback")}</button></div><p className="text-xs text-zinc-400">{text("完全免费 · Fitness for Everybody", "Always free · Fitness for Everybody")}</p>
  </div></footer>;
}
