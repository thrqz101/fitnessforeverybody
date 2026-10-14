import { findFoodBrandMatches } from "@/features/recognition/domain/brand-catalog";
import { foodRouterMode } from "@/features/recognition/domain/food-router";
import { classifyWithJev, type FoodRoute } from "@/features/recognition/domain/jev-router";
import { findLocalEvidence, jevRoutingContext, rulesAreCertain } from "@/features/recognition/server/routing-evidence";

export type RoutePreview = { route: FoodRoute; confidence: number } | null;

const maxPreviewLength = 500;

/**
 * Asks Jev for the route while the user is still typing, so recognition can skip that round trip.
 * Returns null whenever recognition will not need Jev (rules are certain, or another router is configured).
 */
export async function previewFoodRoute(description: string, signal?: AbortSignal): Promise<RoutePreview> {
  const text = description.trim();
  if (!text || text.length > maxPreviewLength || foodRouterMode(process.env.FOOD_ROUTER) !== "jev") return null;
  const hasBrand = findFoodBrandMatches(text).length > 0;
  const evidence = findLocalEvidence(text, hasBrand, "zh");
  if (rulesAreCertain(hasBrand, evidence.hasOnlyStrictLocalMatches)) return null;
  const jev = await classifyWithJev(jevRoutingContext(text, evidence), { signal });
  return jev.ok ? { route: jev.route, confidence: jev.confidence } : null;
}
