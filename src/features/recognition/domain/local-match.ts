import type { WeightedNutritionMatch } from "@/shared/catalog/nutrition-db";
import type { Language } from "@/shared/i18n/i18n-utils";
import { foodCatalog, type FoodCatalogItem } from "@/shared/catalog/food-catalog";
import type { StrictLocalFoodMatch, AiFood } from "@/features/recognition/domain/types";
import { localized } from "@/features/recognition/domain/prompts";
import { normalizeFood, applyBrandCatalogToAiFood } from "@/features/recognition/domain/ai-foods";

export function weightedMatchToStrict(match: WeightedNutritionMatch, language: Language): StrictLocalFoodMatch {
  const { item, grams, macros } = match;
  const nameEn = item.nameEn || item.name;
  const warningZh = item.foodKind === "dish" ? "按参考配方计算，可按实际用油调整" : item.missingNutrients.length ? "部分营养指标暂缺，可手动补充" : "";
  const warningEn = item.foodKind === "dish" ? "Reference recipe; adjust for the oil actually used." : item.missingNutrients.length ? "Some nutrient values are unavailable; you can add them manually." : "";
  return {
    weighted: true, preciseMacros: macros, tokens: [normalizeSearchText(match.foodText)], label: item.name,
    food: { name: language === "en" ? nameEn : item.name, nameZh: item.name, nameEn,
      brand: localized(language, "未标品牌", "Unbranded"), brandZh: "未标品牌", brandEn: "Unbranded",
      foodType: localized(language, item.foodKind === "dish" ? "家常食品" : "食品原料", item.foodKind === "dish" ? "Prepared food" : "Ingredient"),
      portionLabel: `${grams}g`, portionLabelZh: `${grams}g`, portionLabelEn: `${grams}g`,
      macros, recognitionMode: "industry-average", warning: language === "en" ? warningEn : warningZh, warningZh, warningEn }
  };
}

const exactSingleFoodRules: Array<{
  label: string;
  tokenGroups: string[][];
  food: AiFood;
}> = [
  {
    label: "白米饭",
    tokenGroups: [["白米饭", "米饭", "熟米饭"]],
    food: {
      name: "白米饭",
      brand: "家常主食 / 行业平均",
      foodType: "主食",
      portionLabel: "1 碗熟米饭约 180g",
      meal: "lunch",
      macros: { protein: 5, carbs: 47, fat: 1, calories: 210, fiber: 1 },
      recognitionMode: "industry-average",
      warning: "按一碗熟白米饭约 180g 估算；大碗、小碗或半碗可以在右侧改。"
    }
  },
  {
    label: "蛋白棒",
    tokenGroups: [["蛋白棒", "proteinbar"]],
    food: {
      name: "蛋白棒",
      brand: "健身补剂 / 行业平均",
      foodType: "蛋白零食",
      portionLabel: "1 根",
      meal: "snack",
      macros: { protein: 20, carbs: 18, fat: 7, calories: 220, fiber: 5 },
      recognitionMode: "industry-average",
      warning: "按常见 50-60g 蛋白棒估算；不同品牌糖醇、脂肪和纤维差异较大。"
    }
  },
  {
    label: "旺旺鲜贝",
    tokenGroups: [["旺旺"], ["鲜贝", "仙贝"]],
    food: {
      name: "旺旺鲜贝",
      brand: "旺旺",
      foodType: "膨化米果",
      portionLabel: "1 块",
      meal: "snack",
      macros: { protein: 1, carbs: 7, fat: 1, calories: 40, fiber: 0 },
      recognitionMode: "brand-product",
      warning: "按一块小米果估算；如果是一整包，热量和碳水需要按包装份量上调。"
    }
  }
];

export function findStrictLocalFoodMatches(description: string): StrictLocalFoodMatch[] {
  const text = normalizeSearchText(description);
  if (!text) return [];

  const exactRuleMatches = exactSingleFoodRules.flatMap((rule): StrictLocalFoodMatch[] => {
    const tokens = matchTokenGroups(rule.tokenGroups, text);
    if (!tokens.length) return [];
    return [{ food: { ...rule.food }, tokens, label: rule.label }];
  });
  const catalogMatches = foodCatalog.flatMap((item): StrictLocalFoodMatch[] => {
    const tokens = getStrictCatalogMatchTokens(item, text);
    if (!tokens.length) return [];
    return [{ food: catalogItemToAiFood(item), tokens, label: item.title }];
  });

  const candidates = [...exactRuleMatches, ...catalogMatches]
    .map((match) => ({ ...match, tokens: uniqueStrings(match.tokens).filter((token) => token.length >= 2) }))
    .filter((match) => match.tokens.length)
    .sort((a, b) => tokenCoverageLength(b.tokens) - tokenCoverageLength(a.tokens));

  const usedTokens: string[] = [];
  const picked: StrictLocalFoodMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.tokens.every((token) => usedTokens.some((used) => used.includes(token) || token.includes(used)))) continue;
    picked.push(candidate);
    usedTokens.push(...candidate.tokens);
  }

  return uniqueStrictLocalMatches(picked).sort((a, b) => firstTokenIndex(text, a.tokens) - firstTokenIndex(text, b.tokens));
}

function matchTokenGroups(tokenGroups: string[][], text: string) {
  const tokens: string[] = [];

  for (const group of tokenGroups) {
    const matched = group
      .map(normalizeSearchText)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .find((token) => text.includes(token));

    if (!matched) return [];
    tokens.push(matched);
  }

  return tokens;
}

export function hasMeaningfulResidualAfterLocal(description: string, matches: StrictLocalFoodMatch[]) {
  let residual = normalizeSearchText(description);

  for (const token of matches.flatMap((match) => match.tokens).sort((a, b) => b.length - a.length)) {
    residual = residual.split(token).join("");
  }

  residual = residual.replace(
    /(今天|早上|中午|晚上|我|吃了|吃|喝了|喝|了|和|及|与|加了|加|还有|另外|再来|大概|左右|约|一个|一根|一块|一片|一碗|一杯|一份|一包|一袋|一盒|半个|半根|半块|半片|半碗|半杯|半份|小份|中份|大份|小碗|大碗|正常|[0-9一二三四五六七八九十半两]+(个|根|块|片|碗|杯|份|包|袋|盒|瓶|条|颗|粒|勺|克|g|ml|毫升)?|[、，。；;,.+＋])/g,
    ""
  );

  return residual.length >= 2;
}

export function buildStrictLocalResponse(matches: StrictLocalFoodMatch[], partial = false, language: Language = "zh") {
  return {
    ok: true,
    provider: "local-food-library",
    isFoodRelated: true,
    message: partial
      ? localized(language, "已添加能确认的食物；其余部分暂未完成，请补充食物名称或份量后再识别。", "Confirmed foods were added. Please provide the names or portions for the remaining foods and try again.")
      : localized(language, "已按食物和份量计算营养并放进草稿箱，可以继续手动微调。", "Nutrition was calculated for the food and portion and added to your draft tray. You can fine-tune the values."),
    partial,
    foods: matches.map((match) => normalizeStrictLocalFood(match, language))
  };
}

export function getStrictLocalMatchPrompt(matches: StrictLocalFoodMatch[]) {
  if (!matches.length) return "";

  const lines = matches.map((match) => {
    const macros = match.food.macros;
    return `- ${match.food.brand ?? "未标品牌"} ${match.food.name ?? match.label}，份量=${match.food.portionLabel ?? "本地库份量"}，P${macros?.protein ?? 0}/C${macros?.carbs ?? 0}/F${macros?.fat ?? 0}/K${macros?.calories ?? 0}/纤维${macros?.fiber ?? 0}`;
  });

  return [
    "本地库已严格命中以下食物，并会由服务端计入最终结果：",
    ...lines,
    "规则：不要重复输出这些已命中的份量；只分析剩余输入中的额外食物。剩余输入如果有同名食物的额外份量，仍需单独输出。如果没有额外食物，foods 返回空数组。"
  ].join("\n");
}

function normalizeStrictLocalFood(match: StrictLocalFoodMatch, language: Language) {
  const food = normalizeFood(match.food, "ai-text", language);
  // Keep source precision for later portion adjustments; round only displayed totals.
  return match.preciseMacros ? { ...food, baseMacros: match.preciseMacros } : food;
}

export function mergeStrictLocalAndAiFoods(
  localMatches: StrictLocalFoodMatch[],
  aiFoods: AiFood[],
  description: string,
  source: "ai-text" = "ai-text",
  language: Language = "zh"
) {
  const localFoods = localMatches.map((match) => normalizeStrictLocalFood(match, language));
  const filteredAiFoods = filterAiFoodsCoveredByStrictLocal(aiFoods, localMatches)
    .map((food) => normalizeFood(applyBrandCatalogToAiFood(food, description), source, language));

  return [...localFoods, ...filteredAiFoods];
}

function filterAiFoodsCoveredByStrictLocal(foods: AiFood[], localMatches: StrictLocalFoodMatch[]) {
  if (!localMatches.length) return foods;

  return foods.filter((food) => {
    const foodText = normalizeSearchText(`${food.brand ?? ""}${food.name ?? ""}${food.foodType ?? ""}${food.portionLabel ?? ""}`);
    // Weighted matches have already been removed from the model's input. A
    // remaining portion of the same food must not be silently dropped.
    return !localMatches.some((match) => !match.weighted && match.tokens.some((token) => token.length >= 2 && foodText.includes(token)));
  });
}

function getStrictCatalogMatchTokens(item: FoodCatalogItem, text: string) {
  const title = normalizeSearchText(item.title);
  if (title.length >= 4 && text.includes(title)) return [title];

  const titleTokens = splitSearchTokens(item.title)
    .map(cleanExactFoodToken)
    .filter((token) => token.length >= 2 && !isLooseExactToken(token));
  if (titleTokens.length >= 2 && titleTokens.every((token) => isExactTokenPresent(token, text))) {
    return uniqueStrings(titleTokens);
  }

  const itemTokens = item.items
    .flatMap((part) => splitSearchTokens(part))
    .map(cleanExactFoodToken)
    .filter((token) => token.length >= 2 && !isLooseExactToken(token));
  if (itemTokens.length >= 2 && itemTokens.every((token) => isExactTokenPresent(token, text))) {
    return uniqueStrings(itemTokens);
  }

  return [];
}

function tokenCoverageLength(tokens: string[]) {
  return tokens.reduce((total, token) => total + token.length, 0);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueStrictLocalMatches(matches: StrictLocalFoodMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = normalizeSearchText(`${match.food.brand ?? ""}${match.food.name ?? match.label}${match.food.foodType ?? ""}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function firstTokenIndex(text: string, tokens: string[]) {
  const indexes = tokens
    .map((token) => text.indexOf(token))
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
}

export function buildExactLocalResult(description: string, language: Language = "zh") {
  const matches = findStrictLocalFoodMatches(description);
  if (!matches.length) return null;
  return buildStrictLocalResponse(matches, true, language);
}

export function cleanExactFoodToken(token: string) {
  return normalizeSearchText(token)
    .replace(/\d+(\.\d+)?(g|克|ml|毫升)?/gi, "")
    .replace(/半份|半碗|[一二三四五六七八九十半小中大]+(份|个|块|片|杯|碗|寸|串|只|枚|袋|勺)/g, "")
    .replace(/正常|少量|加量|无糖|不加|少酱|少油|jr\./gi, "");
}

function isLooseExactToken(token: string) {
  return /^(咖啡|拿铁|奶茶|汉堡|饮料|茶饮|水果|蔬菜|青菜|牛肉|鸡肉|猪肉|豆腐|酸奶|沙拉|蛋白|套餐|快餐|主食|配菜|小食)$/.test(token);
}

function isExactTokenPresent(token: string, text: string) {
  if (text.includes(token)) return true;
  if (token === "米饭") return /米饭|盖饭|盖浇饭/.test(text);
  if (token === "无糖茶" || token === "无糖饮料") return /无糖茶|无糖饮料|无糖可乐|无糖汽水/.test(text);
  return false;
}

export function splitSearchTokens(value: string) {
  return normalizeSearchText(value)
    .split(/[/／+＋、，,;；:：|｜\s]+/)
    .filter(Boolean);
}

function catalogItemToAiFood(item: FoodCatalogItem): AiFood {
  return {
    name: item.title,
    brand: item.brand,
    foodType: item.foodType,
    portionLabel: "本地库正常份",
    meal: item.category === "snack" || item.category === "topup" || item.category === "protein" ? "snack" : "lunch",
    macros: item.macros,
    recognitionMode: item.brand.includes("平均") ? "industry-average" : "brand-product",
    warning: "按本地食物库近似值估算；如果份量偏大或偏小，可以在右侧改数字。"
  };
}

export function uniqueAiFoods(foods: AiFood[]) {
  const seen = new Set<string>();
  return foods.filter((food) => {
    const key = normalizeSearchText(`${food.brand ?? ""}${food.name ?? ""}${food.foodType ?? ""}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}
