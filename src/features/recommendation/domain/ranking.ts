import type { FoodLogItem, MacroTotals, Recommendation, UserProfile, DayState } from "@/shared/domain/types";
import { macroKeys, completion } from "@/shared/domain/nutrition";
import { recommendationCoverage } from "@/shared/domain/recommendation-fit";

export function countMainMeals(foods: FoodLogItem[]) {
  const mainMeals = new Set(
    foods
      .filter((food) => ["breakfast", "lunch", "dinner"].includes(food.meal))
      .map((food) => food.meal)
  );
  return mainMeals.size;
}

export function getCompletionSnapshot(totals: MacroTotals, targets: MacroTotals): MacroTotals & { average: number } {
  const values = macroKeys.reduce((snapshot, macro) => {
    snapshot[macro] = Math.min(140, completion(totals[macro], targets[macro]));
    return snapshot;
  }, {} as MacroTotals);
  return {
    ...values,
    average: Math.round((values.protein + values.carbs + values.fat + values.calories + values.fiber) / 5)
  };
}

export function rankRecommendation(recommendation: Recommendation, gaps: MacroTotals, profile: UserProfile, day: DayState, shouldLightOnly: boolean) {
  const base = recommendationCoverage(recommendation, gaps, profile, day);
  if (shouldLightOnly) return base + (recommendation.category === "meal" ? -2 : 0);
  return base + (recommendation.category === "meal" ? 0.45 : -0.08);
}

export function uniqueRecommendations(items: Recommendation[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${normalizeForKey(item.brand)}::${normalizeForKey(item.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeForKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[+＋/／｜|，,、：:（）()]/g, "");
}
