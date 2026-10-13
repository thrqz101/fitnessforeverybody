"use client";

import { Activity, HeartPulse, Scale, Sparkles } from "lucide-react";
import { useI18n } from "@/shared/i18n/i18n";

/** Left-hand intro panel of the settings form. */
export function OnboardingIntro() {
  const { t } = useI18n();
  return (
    <section className="mesh-panel rounded-[32px] border border-ink/10 p-6 shadow-float sm:p-8">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-moss/20 bg-white/70 px-3 py-1.5 text-sm font-semibold text-moss">
        <Sparkles size={16} aria-hidden="true" />
        {t("本地系统设置")}
      </div>
      <h1 className="max-w-xl text-4xl font-black leading-tight text-ink sm:text-5xl">
        {t("你的身体参数，只填一次就好。")}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-ink/68">
        {t("这些信息会保存在当前浏览器里。之后打开网页会直接进入今日任务，不需要每次重新输入。")}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] border border-ink/10 bg-white/72 p-4">
          <Activity className="mb-3 text-moss" size={22} aria-hidden="true" />
          <p className="text-sm font-bold">{t("目标驱动")}</p>
          <p className="mt-1 text-xs leading-5 text-ink/58">{t("增肌、减脂、减肥/减重和健康管理各自计算。")}</p>
        </div>
        <div className="rounded-[18px] border border-ink/10 bg-white/72 p-4">
          <Scale className="mb-3 text-coral" size={22} aria-hidden="true" />
          <p className="text-sm font-bold">{t("估算即可")}</p>
          <p className="mt-1 text-xs leading-5 text-ink/58">{t("用小份、标准份、大份替代称重。")}</p>
        </div>
        <div className="rounded-[18px] border border-ink/10 bg-white/72 p-4">
          <HeartPulse className="mb-3 text-ink" size={22} aria-hidden="true" />
          <p className="text-sm font-bold">{t("快乐补齐")}</p>
          <p className="mt-1 text-xs leading-5 text-ink/58">{t("今日状态在日历里设置，推荐会跟着变。")}</p>
        </div>
      </div>
    </section>
  );
}
