import { defaultDayState, fiberGramBounds, macroMultiplierBounds } from "../nutrition";
import type { DayState, DietDayStatus, GoalType, MacroMultipliers, UserProfile } from "../types";

const goals: GoalType[] = ["muscle", "fat_loss", "weight_loss", "health"];
const dietStatuses: DietDayStatus[] = ["normal", "high_carb", "low_carb", "high_protein", "free"];
const intensities: DayState["intensity"][] = ["light", "medium", "hard"];

function num(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

/** Strict validation for client input. Returns null when anything is out of range. */
export function parseProfile(input: unknown): UserProfile | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const heightCm = num(raw.heightCm, 50, 260);
  const weightKg = num(raw.weightKg, 20, 400);
  const age = num(raw.age, 10, 120);
  const bmrKcal = num(raw.bmrKcal, 500, 6000);
  const targetWeightKg = num(raw.targetWeightKg, 20, 400);
  const trainingStyle = str(raw.trainingStyle, 40);
  const eatingPattern = str(raw.eatingPattern, 40);
  if (heightCm === null || weightKg === null || age === null || bmrKcal === null || targetWeightKg === null || !trainingStyle || !eatingPattern) return null;
  if (!Number.isInteger(age)) return null;
  if (raw.gender !== "male" && raw.gender !== "female") return null;
  if (!goals.includes(raw.goal as GoalType)) return null;

  const profile: UserProfile = { heightCm, weightKg, gender: raw.gender, age, bmrKcal, goal: raw.goal as GoalType, targetWeightKg, trainingStyle, eatingPattern };

  for (const key of ["bodyFat", "targetBodyFat"] as const) {
    if (raw[key] === undefined || raw[key] === null) continue;
    const value = num(raw[key], 2, 70);
    if (value === null) return null;
    profile[key] = value;
  }
  if (raw.macroMultipliers !== undefined && raw.macroMultipliers !== null) {
    const multipliers = raw.macroMultipliers as Record<string, unknown>;
    const parsed: Partial<MacroMultipliers> = {};
    for (const key of ["protein", "carbs", "fat"] as const) {
      const bounds = macroMultiplierBounds[key];
      const value = num(multipliers?.[key], bounds.min, bounds.max);
      if (value === null) return null;
      parsed[key] = value;
    }
    profile.macroMultipliers = parsed as MacroMultipliers;
  }
  if (raw.fiberGrams !== undefined && raw.fiberGrams !== null) {
    const value = num(raw.fiberGrams, fiberGramBounds.min, fiberGramBounds.max);
    if (value === null) return null;
    profile.fiberGrams = value;
  }
  return profile;
}

/** Strict validation for client input. */
export function parseDay(input: unknown): DayState | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const trainingSets = num(raw.trainingSets, 0, 200);
  const durationMinutes = num(raw.durationMinutes, 0, 600);
  const trainingPart = typeof raw.trainingPart === "string" && raw.trainingPart.length <= 40 ? raw.trainingPart : null;
  if (typeof raw.isTrainingDay !== "boolean" || trainingSets === null || durationMinutes === null || trainingPart === null) return null;
  if (!intensities.includes(raw.intensity as DayState["intensity"]) || !dietStatuses.includes(raw.dietStatus as DietDayStatus)) return null;
  return { isTrainingDay: raw.isTrainingDay, trainingPart, intensity: raw.intensity as DayState["intensity"], trainingSets, durationMinutes, dietStatus: raw.dietStatus as DietDayStatus };
}

/** Lenient read of stored day settings: anything invalid falls back to defaults. */
export function coerceDay(raw: unknown): DayState {
  return parseDay({ ...defaultDayState, ...(raw && typeof raw === "object" ? raw : {}) }) ?? defaultDayState;
}
