import type { DayState, DietDayStatus, FoodLogItem, GoalType, MacroKey, MacroTotals, Recommendation, UserProfile } from "@/lib/types";

export const macroKeys: MacroKey[] = ["protein", "carbs", "fat", "calories", "fiber"];

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

export const goalLabels: Record<GoalType, string> = {
  muscle: "增肌",
  fat_loss: "减脂",
  weight_loss: "减肥/减重",
  health: "健康管理"
};

export const macroLabels: Record<MacroKey, { label: string; unit: string; short: string }> = {
  protein: { label: "蛋白质", unit: "g", short: "蛋白" },
  carbs: { label: "碳水", unit: "g", short: "碳水" },
  fat: { label: "脂肪", unit: "g", short: "脂肪" },
  calories: { label: "热量", unit: "kcal", short: "热量" },
  fiber: { label: "膳食纤维", unit: "g", short: "纤维" }
};

export const dietStatusLabels: Record<DietDayStatus, { label: string; detail: string }> = {
  normal: { label: "普通日", detail: "新手推荐，休息日也默认用这个。" },
  high_carb: { label: "高碳日", detail: "适合腿、背、全身或高强度训练。" },
  low_carb: { label: "低碳日", detail: "适合休息日或轻训练日。" },
  high_protein: { label: "高蛋白日", detail: "适合训练后恢复或减脂保肌肉。" },
  free: { label: "放纵日", detail: "可以灵活吃，但系统仍帮你盯住边界。" }
};

export function estimateBmr(profile: Pick<UserProfile, "heightCm" | "weightKg" | "age" | "gender">) {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return Math.round(profile.gender === "male" ? base + 5 : base - 161);
}

export function calculateTargets(profile: UserProfile, day: DayState): MacroTotals {
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

export function recommendationCoverage(recommendation: Recommendation, gaps: MacroTotals, profile?: UserProfile, day?: DayState) {
  const scoredKeys: MacroKey[] = ["protein", "carbs", "fat", "fiber"];
  const isSmallGap = isLightTopUpGap(gaps);
  const coverage = scoredKeys.reduce((sum, key) => {
    const gap = Math.max(gaps[key], 1);
    return sum + Math.min(recommendation.macros[key] / gap, 1);
  }, 0);

  const overagePenalty = scoredKeys.reduce((sum, key) => {
    const gap = Math.max(gaps[key], 1);
    const ratio = recommendation.macros[key] / gap;
    return sum + Math.max(0, ratio - 1.25) * 0.18;
  }, 0);

  const fitBonus = isSmallGap
    ? (recommendation.category === "topup" || recommendation.category === "snack" ? 0.36 : 0) + (recommendation.category === "protein" ? 0.22 : 0) + (recommendation.category === "meal" ? -0.22 : 0)
    : recommendation.category === "meal"
      ? 0.16
      : recommendation.category === "snack"
        ? 0.04
        : -0.02;

  return Math.max(0, coverage / scoredKeys.length - overagePenalty + fitBonus + getDietRecommendationBonus(recommendation, profile, day) + getGoalRecommendationAdjustment(recommendation, profile));
}

export function formatMacro(value: number, key: MacroKey) {
  return `${Math.round(value)}${macroLabels[key].unit}`;
}

export function isLightTopUpGap(gaps: MacroTotals) {
  return gaps.calories <= 520 && gaps.protein <= 28 && gaps.carbs <= 55 && gaps.fat <= 22 && gaps.fiber <= 12;
}

export function hasMeaningfulGap(gaps: MacroTotals) {
  return gaps.protein >= 8 || gaps.carbs >= 18 || gaps.fat >= 10 || gaps.calories >= 180 || gaps.fiber >= 5;
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

function getDietRecommendationBonus(recommendation: Recommendation, profile?: UserProfile, day?: DayState) {
  if (!profile || !day) return 0;

  let bonus = 0;

  if (day.dietStatus === "high_carb" && recommendation.macros.carbs >= 50) bonus += 0.1;
  if (day.dietStatus === "low_carb" && recommendation.macros.carbs <= 25) bonus += 0.1;
  if (day.dietStatus === "high_protein" && recommendation.macros.protein >= 25) bonus += 0.12;
  if (day.dietStatus === "free" && recommendation.category === "meal") bonus += 0.05;
  if (profile.eatingPattern === "16+8 间歇性断食" && recommendation.category === "meal") bonus += 0.06;
  if (profile.eatingPattern === "外卖 / 便利店为主" && ["711", "便利店加餐", "夜宵正餐"].includes(recommendation.brand)) bonus += 0.08;

  return bonus;
}

function getGoalRecommendationAdjustment(recommendation: Recommendation, profile?: UserProfile) {
  if (!profile) return 0;

  const text = `${recommendation.title} ${recommendation.brand} ${recommendation.items.join(" ")}`;
  const joyFood = /奶茶|火锅|烧烤|薯|炸|可乐/.test(text);
  const leanProtein = /蛋白粉|鸡胸|鸡蛋|茶叶蛋|酸奶|牛肉|蔬菜/.test(text);

  if (profile.goal === "weight_loss") {
    return (joyFood ? -0.22 : 0) + (leanProtein ? 0.1 : 0) + (recommendation.macros.calories <= 360 ? 0.08 : 0);
  }

  if (profile.goal === "fat_loss") {
    return (joyFood ? -0.14 : 0) + (leanProtein ? 0.12 : 0) + (recommendation.macros.protein >= 25 ? 0.08 : 0);
  }

  if (profile.goal === "muscle") {
    return recommendation.macros.protein >= 35 || recommendation.macros.carbs >= 55 ? 0.08 : 0;
  }

  return recommendation.macros.fiber >= 6 ? 0.06 : 0;
}
