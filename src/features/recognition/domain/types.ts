import type { MealType, MacroTotals } from "@/shared/domain/types";

export type AiFood = {
  name?: string;
  brand?: string;
  foodType?: string;
  portionLabel?: string;
  meal?: MealType;
  macros?: Partial<MacroTotals>;
  recognitionMode?: "brand-product" | "industry-average";
  warning?: string;
  nameZh?: string;
  nameEn?: string;
  brandZh?: string;
  brandEn?: string;
  foodTypeZh?: string;
  foodTypeEn?: string;
  portionLabelZh?: string;
  portionLabelEn?: string;
  warningZh?: string;
  warningEn?: string;
  sourceLabelZh?: string;
  sourceLabelEn?: string;
};

export type AiPayload = {
  isFoodRelated?: boolean;
  message?: string;
  foods?: AiFood[];
};

export type AiRouteKind = "local_exact" | "brand_search" | "ai_estimate" | "not_food";

export type AiRouteDecision = {
  isFoodRelated?: boolean;
  message?: string;
  route?: AiRouteKind;
  brand?: string;
  product?: string;
  reason?: string;
  foods?: AiFood[];
};

export type SearchDiagnostics = { depth: string; resultCount: number; status: string; providerMs?: number; invalidParameter?: string };

export type TimingStage = "brandMatch" | "localLookup" | "routing" | "search" | "searchLlm" | "estimateLlm" | "repairLlm" | "normalize";

export type StrictLocalFoodMatch = {
  food: AiFood;
  tokens: string[];
  label: string;
  weighted?: boolean;
  preciseMacros?: MacroTotals;
};
