import type { MacroKey, MacroMultiplierKey, MacroMultipliers, UserProfile, DayState, MacroTotals, FoodLogItem } from "@/shared/domain/types";

export const macroKeys: MacroKey[] = ["protein", "carbs", "fat", "calories", "fiber"];

export const macroMultiplierKeys: MacroMultiplierKey[] = ["protein", "carbs", "fat"];

export const macroMultiplierBounds: Record<MacroMultiplierKey, { min: number; max: number; step: number }> = {
  protein: { min: 0.8, max: 2.6, step: 0.01 },
  carbs: { min: 0.8, max: 6, step: 0.01 },
  fat: { min: 0.35, max: 1.25, step: 0.01 }
};

export const defaultMacroMultipliers: MacroMultipliers = {
  protein: 1.6,
  carbs: 2.8,
  fat: 0.75
};

export const fiberGramBounds = {
  min: 15,
  max: 50,
  step: 1
};

export const defaultFiberGrams = 30;

export const defaultProfile: UserProfile = {
  heightCm: 172,
  weightKg: 68,
  gender: "male",
  age: 28,
  bmrKcal: 1630,
  goal: "muscle",
  targetWeightKg: 72,
  bodyFat: 18,
  targetBodyFat: 15,
  trainingStyle: "三分化",
  eatingPattern: "三餐正常"
};

export const defaultDayState: DayState = {
  isTrainingDay: true,
  trainingPart: "全身",
  intensity: "medium",
  trainingSets: 10,
  durationMinutes: 60,
  dietStatus: "normal"
};

export function estimateBmr(profile: Pick<UserProfile, "heightCm" | "weightKg" | "age" | "gender">) {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return Math.round(profile.gender === "male" ? base + 5 : base - 161);
}

export function calculateTargets(profile: UserProfile, day: DayState): MacroTotals {
  const targets = calculateSystemTargets(profile, day);
  const fiber = profile.fiberGrams ? normalizeFiberGrams(profile.fiberGrams, targets.fiber) : targets.fiber;

  if (!profile.macroMultipliers || profile.weightKg <= 0) {
    return {
      ...targets,
      fiber
    };
  }

  const multipliers = normalizeMacroMultipliers(
    profile.macroMultipliers,
    calculateMacroMultipliersFromTargets(targets, profile.weightKg)
  );

  const customized = roundMacros({
    ...targets,
    protein: profile.weightKg * multipliers.protein,
    carbs: profile.weightKg * multipliers.carbs,
    fat: profile.weightKg * multipliers.fat,
    fiber
  });
  return { ...customized, calories: calculateCaloriesFromMacros(customized) };
}

export function calculateRecommendedMacroMultipliers(profile: UserProfile, day: DayState): MacroMultipliers {
  return calculateMacroMultipliersFromTargets(calculateSystemTargets(profile, day), profile.weightKg);
}

export function calculateSystemCalorieBudget(profile: UserProfile, day: DayState) {
  return calculateSystemTargets(profile, day).calories;
}

export function calculateRecommendedFiberGrams(profile: UserProfile, day: DayState) {
  return normalizeFiberGrams(calculateSystemTargets(profile, day).fiber);
}

export function calculateCaloriesFromMacroMultipliers(weightKg: number, multipliers: MacroMultipliers) {
  const weight = Math.max(0, weightKg);

  return calculateCaloriesFromMacros({
    protein: Math.round(weight * multipliers.protein),
    carbs: Math.round(weight * multipliers.carbs),
    fat: Math.round(weight * multipliers.fat)
  });
}

export function calculateCaloriesFromMacros(macros: Pick<MacroTotals, "protein" | "carbs" | "fat">) {
  return Math.round(
    Math.max(0, macros.protein) * 4 +
    Math.max(0, macros.carbs) * 4 +
    Math.max(0, macros.fat) * 9
  );
}

export function calculateMacroMultipliersFromTargets(targets: MacroTotals, weightKg: number): MacroMultipliers {
  const divisor = Math.max(1, weightKg);

  return normalizeMacroMultipliers(
    {
      protein: targets.protein / divisor,
      carbs: targets.carbs / divisor,
      fat: targets.fat / divisor
    },
    defaultMacroMultipliers
  );
}

export function normalizeMacroMultipliers(
  multipliers: Partial<MacroMultipliers> | undefined,
  fallback: MacroMultipliers = defaultMacroMultipliers
): MacroMultipliers {
  return macroMultiplierKeys.reduce((normalized, key) => {
    const value = Number(multipliers?.[key]);
    normalized[key] = clampMacroMultiplier(key, Number.isFinite(value) && value > 0 ? value : fallback[key]);
    return normalized;
  }, {} as MacroMultipliers);
}

export function clampMacroMultiplier(key: MacroMultiplierKey, value: number) {
  const bounds = macroMultiplierBounds[key];
  const safeValue = Number.isFinite(value) ? value : defaultMacroMultipliers[key];
  return roundMultiplier(Math.min(bounds.max, Math.max(bounds.min, safeValue)));
}

export function normalizeFiberGrams(value: number | undefined, fallback = defaultFiberGrams) {
  const safeValue = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
  return clampFiberGrams(safeValue);
}

export function clampFiberGrams(value: number) {
  const safeValue = Number.isFinite(value) ? value : defaultFiberGrams;
  return Math.round(Math.min(fiberGramBounds.max, Math.max(fiberGramBounds.min, safeValue)));
}

function calculateSystemTargets(profile: UserProfile, day: DayState): MacroTotals {
  const bmr = profile.bmrKcal > 0 ? profile.bmrKcal : estimateBmr(profile);
  const trainingBoost = day.isTrainingDay ? 1 : 0;
  const intensityBoost = day.intensity === "hard" ? 120 : day.intensity === "medium" ? 60 : 0;
  const trainingLoadBoost = getTrainingLoadBoost(profile, day);

  let targets: MacroTotals;

  if (profile.goal === "muscle") {
    targets = {
      protein: profile.weightKg * (day.isTrainingDay ? 2.05 : 1.6),
      carbs: profile.weightKg * (day.isTrainingDay ? 4.1 : 3.1),
      fat: profile.weightKg * 0.9,
      calories: bmr * 1.42 + 170 + trainingBoost * 300 + intensityBoost + trainingLoadBoost,
      fiber: 30
    };
    return applyDietAdjustments(targets, profile, day);
  }

  if (profile.goal === "fat_loss") {
    targets = {
      protein: profile.weightKg * (day.isTrainingDay ? 2 : 1.8),
      carbs: profile.weightKg * (day.isTrainingDay ? 2.9 : 2.15),
      fat: profile.weightKg * 0.72,
      calories: bmr * 1.32 - 260 + trainingBoost * 130 + trainingLoadBoost * 0.45,
      fiber: 32
    };
    return applyDietAdjustments(targets, profile, day);
  }

  if (profile.goal === "weight_loss") {
    targets = {
      protein: profile.weightKg * 1.35,
      carbs: profile.weightKg * (day.isTrainingDay ? 2.35 : 1.8),
      fat: profile.weightKg * 0.62,
      calories: bmr * 1.22 - 300 + trainingBoost * 90 + trainingLoadBoost * 0.3,
      fiber: 28
    };
    return applyDietAdjustments(targets, profile, day);
  }

  targets = {
    protein: profile.weightKg * 1.35,
    carbs: profile.weightKg * (day.isTrainingDay ? 3.2 : 2.6),
    fat: profile.weightKg * 0.78,
    calories: bmr * 1.35 + trainingBoost * 160 + trainingLoadBoost * 0.35,
    fiber: 30
  };
  return applyDietAdjustments(targets, profile, day);
}

function roundMultiplier(value: number) {
  return Math.round(value * 100) / 100;
}

export function emptyMacros(): MacroTotals {
  return { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 };
}

export function sumFoods(foods: FoodLogItem[]): MacroTotals {
  return foods.reduce(
    (total, food) => addMacros(total, food.macros),
    emptyMacros()
  );
}

export function addMacros(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    calories: a.calories + b.calories,
    fiber: a.fiber + b.fiber
  };
}

export function remainingMacros(targets: MacroTotals, totals: MacroTotals): MacroTotals {
  return {
    protein: Math.max(0, targets.protein - totals.protein),
    carbs: Math.max(0, targets.carbs - totals.carbs),
    fat: Math.max(0, targets.fat - totals.fat),
    calories: Math.max(0, targets.calories - totals.calories),
    fiber: Math.max(0, targets.fiber - totals.fiber)
  };
}

export function scaleMacros(macros: MacroTotals, scale: number): MacroTotals {
  return roundMacros({
    protein: macros.protein * scale,
    carbs: macros.carbs * scale,
    fat: macros.fat * scale,
    calories: macros.calories * scale,
    fiber: macros.fiber * scale
  });
}

export function roundMacros(macros: MacroTotals): MacroTotals {
  return {
    protein: Math.round(macros.protein),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
    calories: Math.round(macros.calories),
    fiber: Math.round(macros.fiber)
  };
}

export function completion(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.round((value / target) * 100);
}

function getTrainingLoadBoost(profile: UserProfile, day: DayState) {
  if (!day.isTrainingDay || profile.trainingStyle === "不训练") return 0;

  const partBoost = ["腿", "背", "全身"].some((part) => day.trainingPart.includes(part)) ? 120 : 55;
  const setBoost = day.trainingSets >= 15 ? 120 : day.trainingSets >= 10 ? 70 : day.trainingSets >= 5 ? 35 : 0;
  const durationBoost = day.durationMinutes >= 90 ? 120 : day.durationMinutes >= 60 ? 65 : day.durationMinutes >= 30 ? 25 : 0;
  const styleBoost = profile.trainingStyle === "功能性训练" ? 75 : profile.trainingStyle === "五分化" ? 45 : profile.trainingStyle === "徒手训练" ? 20 : 35;

  return partBoost + setBoost + durationBoost + styleBoost;
}

function applyDietAdjustments(targets: MacroTotals, profile: UserProfile, day: DayState) {
  const adjusted = { ...targets };

  if (profile.trainingStyle === "不训练") {
    adjusted.carbs *= 0.86;
    adjusted.calories -= 160;
  }

  if (profile.eatingPattern === "16+8 间歇性断食") {
    adjusted.protein *= 1.03;
  }

  if (profile.eatingPattern === "地中海 / 均衡饮食") {
    adjusted.fiber += 4;
    adjusted.fat *= 0.95;
  }

  if (profile.eatingPattern === "外卖 / 便利店为主") {
    adjusted.fiber += 5;
  }

  if (day.dietStatus === "high_carb") {
    adjusted.carbs *= 1.28;
    adjusted.calories += 220;
    adjusted.fat *= 0.9;
  }

  if (day.dietStatus === "low_carb") {
    adjusted.carbs *= 0.65;
    adjusted.protein *= 1.08;
    adjusted.fat *= 1.05;
    adjusted.calories -= 120;
  }

  if (day.dietStatus === "high_protein") {
    adjusted.protein *= 1.16;
    adjusted.carbs *= 0.92;
    adjusted.calories += 60;
  }

  if (day.dietStatus === "free") {
    adjusted.carbs *= 1.08;
    adjusted.fat *= 1.1;
    adjusted.calories += 250;
    adjusted.fiber += 3;
  }

  return roundMacros(adjusted);
}
