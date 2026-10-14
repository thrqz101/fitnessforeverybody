import type { FoodRoute } from "./jev-router";

export type FoodRouterMode = "jev" | "rules" | "llm";

/** FOOD_ROUTER selects the router; Jev is the default and falls back to the instant rules router. */
export function foodRouterMode(value: string | undefined): FoodRouterMode {
  switch (value) {
    case "rules":
    case "llm":
      return value;
    default:
      return "jev";
  }
}

export type RuleRoutingInput = {
  description: string;
  hasBrand: boolean;
  brandOnly: boolean;
  localCoverageComplete: boolean;
};

/** Brand evidence takes priority; incomplete local matches must be estimated. */
export function selectRuleFoodRoute(input: RuleRoutingInput): FoodRoute {
  if (!input.description.trim() || input.brandOnly) return "not_food";
  if (input.hasBrand) return "brand_search";
  return input.localCoverageComplete ? "local_exact" : "ai_estimate";
}

/** Fixed serving values are unsafe when the user specifies a different amount. */
export function hasNonstandardPortion(description: string): boolean {
  return /半|[大小中]份|[大小]碗|加量|双倍|多人|分食|剩下|[二两三四五六七八九十百]+(?:个|份|碗|杯|根|块|片|只|盘|盒)|(?:\d+\.\d+|[1-9]\d+|[2-9])(?:个|份|碗|杯|根|块|片|只|盘|盒)|\d+(?:\.\d+)?\s*(?:克|千克|公斤|毫升|kg\b|g\b|ml\b)|half|double|large|small|shared|\b[2-9]\d*\s*(?:servings?|bowls?|cups?|pieces?)/i.test(description);
}
