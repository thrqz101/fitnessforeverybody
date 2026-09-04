import {
  getDbMeta,
  scalePer100gToGrams,
  searchNutritionDb,
  type NutritionItem
} from "@/lib/nutrition-db";

type QueryLocalFoodDbArgs = {
  food: string;
  grams?: number;
};

type SlimMatch = { name: string; nameEn?: string; matchType: string; per100g: NutritionItem["per100g"] };

export async function queryLocalFoodDb(args: QueryLocalFoodDbArgs) {
  const dbMeta = getDbMeta();
  const results = searchNutritionDb(args.food, 5);

  if (!results.length) {
    return {
      ok: false,
      source: "local_db",
      dbMeta,
      message: `本地食品库未找到「${args.food}」。`,
      matches: []
    };
  }

  const top = results[0];
  const grams = args.grams && args.grams > 0 ? args.grams : 100;
  const macros = scalePer100gToGrams(top.item.per100g, grams);
  const matches: SlimMatch[] = results.slice(1).map((r) => ({
    name: r.item.name,
    nameEn: r.item.nameEn,
    matchType: r.matchType,
    per100g: r.item.per100g
  }));

  return {
    ok: true,
    source: "local_db",
    dbMeta,
    food: top.item.name,
    nameEn: top.item.nameEn,
    category: top.item.category,
    grams,
    unit: "per_100g",
    matchType: top.matchType,
    matchedTerm: top.matchedTerm,
    per100g: top.item.per100g,
    macros,
    matches
  };
}
