import type { Recommendation } from "@/shared/domain/types";
import { foodCatalog, type FoodCatalogItem, catalogItemToRecommendation } from "@/shared/catalog/food-catalog";
import { scaleMacros } from "@/shared/domain/nutrition";
import { type StyleFilter, getRecommendationText, matchesStyleFilter } from "@/features/recommendation/domain/filters";
import { uniqueRecommendations, normalizeForKey } from "@/features/recommendation/domain/ranking";

const shuffleBucketOrder: Exclude<StyleFilter, "all">[] = [
  "breakfast",
  "stir_fry",
  "hotpot",
  "malatang",
  "korean_bbq",
  "japanese",
  "skewer_bbq",
  "steak",
  "rice_noodle",
  "fast_food",
  "tea_coffee",
  "convenience",
  "light_meal",
  "fruit_snack",
  "supplement"
];

export function buildBottomFoodShufflePool(aiItems: Recommendation[]) {
  return uniqueRecommendations([
    ...aiItems,
    ...foodCatalog.flatMap((item) => buildCatalogShuffleVariants(item))
  ]);
}

function buildCatalogShuffleVariants(item: FoodCatalogItem) {
  const base = {
    ...catalogItemToRecommendation(item),
    id: `shuffle-${item.id}`,
    note: `${item.note}（从底层食物库抽样，份量可按饥饿程度微调。）`
  };
  const variants: Recommendation[] = [base];

  if (item.category === "meal") {
    const smallMealSuffix = /早餐|早点|包子|馒头|胡辣汤|馄饨|云吞|煎饼|鸡蛋灌饼|小米粥|油条|肠粉|小笼包|热干面|豆浆/.test(getRecommendationText(base))
      ? "小份早餐"
      : "小份夜宵";
    variants.push(makeCatalogShuffleVariant(base, smallMealSuffix, 0.72, `按${smallMealSuffix}估算`));
    variants.push(makeCatalogShuffleVariant(base, "训练日加量", 1.12, "按训练日加量估算"));
  }

  if (item.category === "topup" || item.category === "snack" || item.category === "protein") {
    variants.push(makeCatalogShuffleVariant(base, "轻补小份", 0.82, "按轻补小份估算"));
  }

  if (item.items.length >= 4) {
    variants.push({
      ...base,
      id: `${base.id}-combo-${normalizeForKey(item.items.slice(0, 3).join(""))}`,
      title: `${item.title}（${item.items.slice(0, 3).join(" + ")}）`,
      items: item.items.slice(0, 4),
      macros: scaleMacros(item.macros, 0.88),
      note: `${item.foodType}里的具体组合抽样，按前几项主菜和配菜估算。`
    });
  }

  if (/火锅|麻辣烫|冒菜|烤肉|烧烤|牛排|日料|炒菜|盖饭|粉|面/.test(`${item.foodType} ${item.title}`)) {
    variants.push(makeCatalogShuffleVariant(base, "换个配菜组合", 0.95, "同品类换配菜估算"));
  }

  return variants;
}

function makeCatalogShuffleVariant(item: Recommendation, suffix: string, scale: number, itemSuffix: string): Recommendation {
  return {
    ...item,
    id: `${item.id}-${normalizeForKey(suffix)}`,
    title: `${item.title}（${suffix}）`,
    items: [...item.items.slice(0, 7), itemSuffix],
    macros: scaleMacros(item.macros, scale),
    note: `${item.note} 摇一摇按${suffix}估算，实际可以按饥饿程度微调。`
  };
}

export function pickStratifiedShuffleWinner(items: Recommendation[], runId: number, recentIds: string[]) {
  const groups = shuffleBucketOrder
    .map((bucket) => items.filter((item) => getShuffleBucket(item) === bucket))
    .filter((group) => group.length > 0);

  if (!groups.length) return items[0];

  const startIndex = runId % groups.length;
  for (let offset = 0; offset < groups.length; offset += 1) {
    const group = groups[(startIndex + offset) % groups.length];
    const freshItems = group.filter((item) => !recentIds.includes(item.id));
    const pickable = freshItems.length ? freshItems : group;
    if (pickable.length) return pickable[Math.floor(Math.random() * pickable.length)];
  }

  return items[Math.floor(Math.random() * items.length)];
}

function getShuffleBucket(recommendation: Recommendation): Exclude<StyleFilter, "all"> {
  return shuffleBucketOrder.find((bucket) => matchesStyleFilter(recommendation, bucket)) ?? "light_meal";
}
