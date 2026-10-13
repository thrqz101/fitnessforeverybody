import type { Recommendation, MacroTotals, UserProfile, DayState, MacroKey } from "@/shared/domain/types";

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

export function isLightTopUpGap(gaps: MacroTotals) {
  return gaps.calories <= 520 && gaps.protein <= 28 && gaps.carbs <= 55 && gaps.fat <= 22 && gaps.fiber <= 12;
}

export function hasMeaningfulGap(gaps: MacroTotals) {
  return gaps.protein >= 8 || gaps.carbs >= 18 || gaps.fat >= 10 || gaps.calories >= 180 || gaps.fiber >= 5;
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
