export type Language = "zh" | "en";

export function normalizeLanguage(value: unknown): Language {
  return String(value ?? "").toLowerCase() === "en" ? "en" : "zh";
}

export function pick(language: Language, zh: string, en: string) {
  return language === "en" ? en : zh;
}

const macroAliases: Record<"protein" | "carbs" | "fat" | "calories" | "fiber", string[]> = {
  protein: ["protein", "蛋白质", "蛋白"],
  carbs: ["carbs", "carbohydrates", "carbohydrate", "碳水", "碳水化合物"],
  fat: ["fat", "脂肪"],
  calories: ["calories", "calorie", "energy", "热量", "卡路里"],
  fiber: ["fiber", "fibre", "膳食纤维", "纤维"]
};

export function readMacroValue(
  macros: Record<string, unknown> | null | undefined,
  key: keyof typeof macroAliases
) {
  if (!macros || typeof macros !== "object") return 0;
  const record = macros as Record<string, unknown>;
  for (const alias of macroAliases[key]) {
    if (alias in record) {
      const numberValue = Number(record[alias] ?? 0);
      if (Number.isFinite(numberValue)) return Math.max(0, Math.round(numberValue));
    }
  }
  return 0;
}

export function normalizeMacroTotals(macros?: Record<string, unknown> | null) {
  return {
    protein: readMacroValue(macros, "protein"),
    carbs: readMacroValue(macros, "carbs"),
    fat: readMacroValue(macros, "fat"),
    calories: readMacroValue(macros, "calories"),
    fiber: readMacroValue(macros, "fiber")
  };
}
