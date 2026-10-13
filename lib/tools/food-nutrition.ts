import { getDbMeta, resolveNutritionFood, scalePer100gToGrams, searchNutritionDb } from "@/lib/nutrition-db";

type QueryLocalFoodDbArgs = { food: string; grams?: number };

/** Agent tool: fuzzy candidates never become an authoritative calculation. */
export async function queryLocalFoodDb(args: QueryLocalFoodDbArgs) {
  const dbMeta = getDbMeta();
  if (args.grams !== undefined && (!Number.isFinite(args.grams) || args.grams <= 0 || args.grams > 100000)) {
    return { ok: false, source: "local_db", dbMeta, reason: "invalid_weight", message: "请提供有效的可食部克数。", matches: [] };
  }
  const resolved = resolveNutritionFood(args.food);
  if (!resolved.item) {
    return {
      ok: false, source: "local_db", dbMeta, reason: resolved.reason,
      needsClarification: resolved.reason === "ambiguous",
      message: resolved.reason === "ambiguous" ? "请明确食物的生熟状态或具体品种。" : "没有找到可直接计算的食物记录。",
      matches: searchNutritionDb(args.food, 5).map(({ item, matchType }) => ({ id: item.id, name: item.name, cookingState: item.cookingState, matchType }))
    };
  }
  const item = resolved.item, grams = args.grams ?? 100;
  return {
    ok: true, source: "local_db", dbMeta, foodId: item.id, food: item.name,
    nameEn: item.nameEn, category: item.category, grams, unit: "per_100g",
    portionDefaulted: args.grams === undefined, cookingState: item.cookingState,
    per100g: item.per100g, macros: scalePer100gToGrams(item.per100g, grams),
    missingNutrients: item.missingNutrients, qualityFlags: item.qualityFlags,
    provenance: item.source, matches: []
  };
}
