"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useI18n();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-ink/12 bg-white/70 p-1 text-xs font-black ${
        compact ? "gap-0" : "gap-1"
      }`}
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLanguage("zh")}
        aria-pressed={language === "zh"}
        className={`rounded-full px-2.5 py-1 transition ${
          language === "zh" ? "bg-moss text-white" : "text-ink/55 hover:text-ink"
        }`}
      >
        中
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={`rounded-full px-2.5 py-1 transition ${
          language === "en" ? "bg-moss text-white" : "text-ink/55 hover:text-ink"
        }`}
      >
        EN
      </button>
    </div>
  );
}
