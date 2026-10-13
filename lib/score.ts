import type { MacroKey, MacroTotals } from "./types";

/** Weights v1. Must match public.weighted_score in the database (protein 25, calories 25, carbs 20, fat 15, fiber 15). */
export const scoreWeights: Record<MacroKey, number> = { protein: 25, calories: 25, carbs: 20, fat: 15, fiber: 15 };

/** Each item counts min(actual / target, 1); the result is 0..1 and unrounded. */
export function weightedScore(totals: MacroTotals, targets: MacroTotals): number {
  let sum = 0;
  for (const key of Object.keys(scoreWeights) as MacroKey[]) {
    const target = targets[key];
    const fraction = target > 0 ? Math.min(Math.max(totals[key], 0) / target, 1) : 0;
    sum += scoreWeights[key] * fraction;
  }
  return sum / 100;
}

/** One decimal, always rounded down, so 49.99% is never shown as 50.0%. */
export function formatScorePercent(score: number): string {
  const clamped = Math.min(Math.max(score, 0), 1);
  return (Math.floor(clamped * 1000 + 1e-9) / 10).toFixed(1);
}
