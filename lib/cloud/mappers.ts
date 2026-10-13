import type { FoodLogItem, MacroTotals, MealType, UserProfile } from "../types";
import type { CloudDay, DayRow, EntryRow, ProfileRow } from "./types";
import { coerceDay } from "./validate";

const meals: MealType[] = ["breakfast", "lunch", "dinner", "snack", "midnight"];
const macroKeyList = ["protein", "carbs", "fat", "calories", "fiber"] as const;

export function sanitizeMacros(value: unknown): MacroTotals | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const out = {} as MacroTotals;
  for (const key of macroKeyList) {
    const n = raw[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 20000) return null;
    out[key] = n;
  }
  return out;
}

export function emptyTotals(): MacroTotals {
  return { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 };
}

const entryOnlyFields = ["id", "macros", "baseMacros", "portionScale", "savedToCalendar", "loggedAt", "recognitionBatchId", "cloud", "entryDate", "source"] as const;

/** FoodLogItem -> the JSON payload stored with an entry (nutrition and identity are separate columns). */
export function foodToEntryPayload(food: FoodLogItem, source: "ai-text" | "manual" | "recommendation") {
  const item: Record<string, unknown> = { ...food };
  for (const key of entryOnlyFields) delete item[key];
  const baseMacros = sanitizeMacros(food.baseMacros ?? food.macros);
  const scale = typeof food.portionScale === "number" && Number.isFinite(food.portionScale) ? Math.min(10, Math.max(0.1, food.portionScale)) : 1;
  return {
    source,
    name: String(food.name ?? "").slice(0, 200) || "未命名食物",
    brand: food.brand ? String(food.brand).slice(0, 200) : null,
    meal: meals.includes(food.meal) ? food.meal : "snack",
    baseMacros,
    portionScale: scale,
    item
  };
}

export function entryRowToFood(row: EntryRow): FoodLogItem {
  const item = (row.item ?? {}) as Partial<FoodLogItem>;
  return {
    foodType: "食品",
    portionLabel: "标准份",
    ...item,
    id: row.id,
    name: row.name,
    brand: row.brand ?? item.brand,
    meal: meals.includes(row.meal as MealType) ? (row.meal as MealType) : "snack",
    baseMacros: row.base_macros,
    macros: row.final_macros,
    portionScale: Number(row.portion_scale),
    source: row.source === "ai-text" || row.source === "recommendation" ? row.source : "manual",
    savedToCalendar: row.status === "confirmed",
    loggedAt: row.confirmed_at ?? row.created_at,
    recognitionBatchId: row.request_id ?? undefined,
    cloud: true,
    entryDate: row.entry_date
  };
}

export function dayRowToCloudDay(row: DayRow): CloudDay {
  return {
    dateKey: row.activity_date,
    day: coerceDay(row.day_settings),
    targets: row.targets ?? null,
    totals: row.totals ?? emptyTotals(),
    flows: row.confirmed_flows,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    finalized: row.finalized_at !== null,
    effective: row.is_effective,
    migrated: row.migrated
  };
}

export function profileRowToProfile(row: ProfileRow): UserProfile | null {
  if (!row.setup_completed || row.height_cm === null || row.weight_kg === null || !row.gender || row.age === null
    || row.bmr_kcal === null || !row.goal || row.target_weight_kg === null) return null;
  const profile: UserProfile = {
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    gender: row.gender === "female" ? "female" : "male",
    age: row.age,
    bmrKcal: Number(row.bmr_kcal),
    goal: row.goal as UserProfile["goal"],
    targetWeightKg: Number(row.target_weight_kg),
    trainingStyle: row.training_style ?? "三分化",
    eatingPattern: row.eating_pattern ?? "三餐正常"
  };
  if (row.body_fat !== null) profile.bodyFat = Number(row.body_fat);
  if (row.target_body_fat !== null) profile.targetBodyFat = Number(row.target_body_fat);
  if (row.macro_multipliers && typeof row.macro_multipliers === "object") profile.macroMultipliers = row.macro_multipliers as UserProfile["macroMultipliers"];
  if (row.fiber_grams !== null) profile.fiberGrams = Number(row.fiber_grams);
  return profile;
}
