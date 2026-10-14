import type { Language } from "@/shared/i18n/i18n-utils";
import { findFoodBrandMatches } from "@/features/recognition/domain/brand-catalog";
import { ruleRejectionMessage } from "@/features/recognition/domain/explicit-items";
import { foodRouterMode } from "@/features/recognition/domain/food-router";
import { classifyWithJev, type FoodRoute } from "@/features/recognition/domain/jev-router";
import { notFoodMessage } from "@/features/recognition/domain/route-decision";
import { findLocalEvidence, jevRoutingContext, rulesAreCertain } from "@/features/recognition/server/routing-evidence";

/** A preview with a message rejects the input: the client shows it instead of starting recognition. */
export type RoutePreview = { route: FoodRoute; confidence: number; message?: string } | null;

const maxPreviewLength = 500;

/**
 * Previews recognition while the user is still typing. The rules reject vague input and too many foods at once;
 * otherwise Jev picks the route, so recognition can skip that round trip, and a not_food choice is rejected.
 * Returns null whenever recognition will not need Jev (rules are certain, or another router is configured).
 */
export async function previewFoodRoute(description: string, language: Language, signal?: AbortSignal): Promise<RoutePreview> {
  const text = description.trim();
  if (!text || text.length > maxPreviewLength) return null;
  const rejection = ruleRejectionMessage(text, language);
  if (rejection) return { route: "not_food", confidence: 1, message: rejection };
  if (foodRouterMode(process.env.FOOD_ROUTER) !== "jev") return null;
  const hasBrand = findFoodBrandMatches(text).length > 0;
  const evidence = findLocalEvidence(text, hasBrand, language);
  if (rulesAreCertain(hasBrand, evidence.hasOnlyStrictLocalMatches)) return null;
  const jev = await classifyWithJev(jevRoutingContext(text, evidence), { signal });
  if (!jev.ok) return null;
  return { route: jev.route, confidence: jev.confidence, ...(jev.route === "not_food" ? { message: notFoodMessage(language) } : {}) };
}
