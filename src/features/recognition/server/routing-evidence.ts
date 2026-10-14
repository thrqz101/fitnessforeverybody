import type { Language } from "@/shared/i18n/i18n-utils";
import { matchWeightedNutrition } from "@/shared/catalog/nutrition-db";
import { getBrandCatalogPrompt } from "@/features/recognition/domain/brand-catalog";
import { hasNonstandardPortion } from "@/features/recognition/domain/food-router";
import type { RoutingContext } from "@/features/recognition/domain/jev-router";
import { findStrictLocalFoodMatches, hasMeaningfulResidualAfterLocal, weightedMatchToStrict } from "@/features/recognition/domain/local-match";

/**
 * Local evidence for routing. Brand lookup always precedes generic food values: with a brand match no
 * local values are used. Explicit weights use the verified 100g records; serving templates cannot override them.
 */
export function findLocalEvidence(description: string, hasBrand: boolean, language: Language) {
  const weighted = !hasBrand ? matchWeightedNutrition(description) : null;
  const canUseFixedLocal = !hasBrand && !weighted?.hasExplicitMass && !hasNonstandardPortion(description);
  const strictLocalMatches = weighted?.hasExplicitMass
    ? weighted.matches.map((match) => weightedMatchToStrict(match, language))
    : canUseFixedLocal ? findStrictLocalFoodMatches(description) : [];
  const hasOnlyStrictLocalMatches =
    strictLocalMatches.length > 0 &&
    (weighted?.hasExplicitMass ? weighted.complete : !hasMeaningfulResidualAfterLocal(description, strictLocalMatches));
  const analysisDescription = weighted?.matches.length && !weighted.complete ? weighted.remainingDescription : description;
  return { weighted, canUseFixedLocal, strictLocalMatches, hasOnlyStrictLocalMatches, analysisDescription };
}

/** Jev only decides what the rules cannot: no known brand and no complete local match. */
export function rulesAreCertain(hasBrand: boolean, hasOnlyStrictLocalMatches: boolean) {
  return hasBrand || hasOnlyStrictLocalMatches;
}

export function jevRoutingContext(description: string, evidence: ReturnType<typeof findLocalEvidence>): RoutingContext {
  return {
    description,
    localCandidates: evidence.strictLocalMatches.map((match) => ({ label: match.label, food: match.food })),
    localCoverageComplete: evidence.hasOnlyStrictLocalMatches,
    brandHints: getBrandCatalogPrompt(description)
  };
}
