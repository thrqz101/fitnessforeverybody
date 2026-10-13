import type { UserProfile, DayRecord, DayState, FoodLogItem } from "@/shared/domain/types";
import { defaultProfile, normalizeMacroMultipliers, calculateRecommendedMacroMultipliers, defaultDayState, normalizeFiberGrams, calculateRecommendedFiberGrams } from "@/shared/domain/nutrition";
import { normalizeSearchEvidence } from "@/shared/domain/search-evidence";

export const profileKey = "ffe-profile";
export const dayKey = "ffe-day";
export const foodsKey = "ffe-foods";
export const recordsKey = "ffe-day-records";

export function normalizeProfile(profile: Partial<UserProfile>): UserProfile {
  const merged = { ...defaultProfile, ...profile };
  const validTrainingStyles = ["三分化", "五分化", "功能性训练", "徒手训练", "不训练"];
  const validDietPatterns = ["三餐正常", "16+8 间歇性断食", "碳循环", "地中海 / 均衡饮食", "外卖 / 便利店为主", "不确定，先按普通模式算"];
  const normalized = {
    ...merged,
    bmrKcal: merged.bmrKcal || defaultProfile.bmrKcal,
    trainingStyle: validTrainingStyles.includes(merged.trainingStyle) ? merged.trainingStyle : defaultProfile.trainingStyle,
    eatingPattern: validDietPatterns.includes(merged.eatingPattern) ? merged.eatingPattern : defaultProfile.eatingPattern
  };

  return {
    ...normalized,
    macroMultipliers: profile.macroMultipliers
      ? normalizeMacroMultipliers(
        profile.macroMultipliers,
        calculateRecommendedMacroMultipliers(normalized, defaultDayState)
      )
      : undefined,
    fiberGrams: profile.fiberGrams
      ? normalizeFiberGrams(
        profile.fiberGrams,
        calculateRecommendedFiberGrams(normalized, defaultDayState)
      )
      : undefined
  };
}

export function parseRecords(raw: string): Record<string, DayRecord> {
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<DayRecord>>;
    return Object.fromEntries(
      Object.entries(parsed).map(([dateKey, record]) => [
        dateKey,
        {
          dateKey,
          day: normalizeDay(record.day ?? defaultDayState),
          foods: normalizeFoods(record.foods ?? [])
        }
      ])
    );
  } catch {
    return {};
  }
}

export function normalizeDay(day: Partial<DayState>): DayState {
  return {
    ...defaultDayState,
    ...day,
    trainingSets: Number.isFinite(day.trainingSets) ? day.trainingSets ?? defaultDayState.trainingSets : defaultDayState.trainingSets,
    durationMinutes: Number.isFinite(day.durationMinutes) ? day.durationMinutes ?? defaultDayState.durationMinutes : defaultDayState.durationMinutes,
    dietStatus: ["normal", "high_carb", "low_carb", "high_protein", "free"].includes(day.dietStatus ?? "")
      ? (day.dietStatus as DayState["dietStatus"])
      : defaultDayState.dietStatus
  };
}

export function normalizeFoods(foods: Partial<FoodLogItem>[]): FoodLogItem[] {
  return foods.map((food) => ({
    ...food,
    id: food.id ?? `food-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: food.name ?? "未命名食物",
    brand: food.brand,
    foodType: food.foodType ?? "食品",
    portionLabel: food.portionLabel ?? "标准份",
    portionScale: food.portionScale ?? 1,
    baseMacros: food.baseMacros ?? food.macros ?? { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 },
    macros: food.macros ?? { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 },
    meal: food.meal ?? "snack",
    warning: food.warning,
    source: ["ai-text", "manual", "recommendation"].includes(food.source ?? "")
      ? (food.source as FoodLogItem["source"])
      : "manual",
    recognitionMode: food.recognitionMode,
    sourceLabel: food.sourceLabel,
    loggedAt: food.loggedAt ?? new Date().toISOString(),
    savedToCalendar: food.savedToCalendar ?? true,
    recognitionBatchId: typeof food.recognitionBatchId === "string" ? food.recognitionBatchId : undefined,
    searchEvidence: normalizeSearchEvidence(food.searchEvidence)
  }));
}

export function markFoodAsDraft(food: FoodLogItem): FoodLogItem {
  return {
    ...food,
    savedToCalendar: false
  };
}
