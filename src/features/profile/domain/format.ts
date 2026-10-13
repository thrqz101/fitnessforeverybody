import type { Language } from "@/shared/i18n/i18n-utils";

export function formatOptionalPercent(value?: number, language: Language = "zh") {
  if (!value || value <= 0) return language === "en" ? "Not set" : "未填写";
  return `${value}%`;
}

export function formatMultiplier(value: number, language: Language = "zh") {
  return language === "en" ? value.toFixed(2) : `${value.toFixed(2)} 倍`;
}

export function formatDailyGrams(grams: number, language: Language = "zh") {
  return language === "en" ? `${grams}g/day` : `${grams}g/天`;
}

export function macroGrams(weightKg: number, multiplier: number) {
  return Math.round(Math.max(0, weightKg) * multiplier);
}
