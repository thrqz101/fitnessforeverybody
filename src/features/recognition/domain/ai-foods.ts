import type { MealType, FoodLogItem, MacroTotals } from "@/shared/domain/types";
import { findFoodBrandMatches } from "@/features/recognition/domain/brand-catalog";
import { type Language, normalizeMacroTotals } from "@/shared/i18n/i18n-utils";
import { translateToZh, translateToEn } from "@/shared/i18n/translations";
import type { AiPayload, AiFood } from "@/features/recognition/domain/types";
import { isVagueFoodDescription } from "@/features/recognition/domain/explicit-items";
import { uniqueAiFoods, normalizeSearchText } from "@/features/recognition/domain/local-match";
import { isGenericDiningDescription } from "@/features/recognition/domain/route-decision";
import { localized } from "@/features/recognition/domain/prompts";

export const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const mealValues: MealType[] = ["breakfast", "lunch", "dinner", "snack", "midnight"];

export function shouldRepairAiPayload(parsed: AiPayload, content: unknown, description: string) {
  if (!description || isVagueFoodDescription(description)) return false;
  if (parsed.isFoodRelated && parsed.foods?.length) return false;
  if (typeof content !== "string") return false;
  return /[\{\[]/.test(content);
}

export function cleanAiFoodsForDescription(foods: AiFood[] | undefined, description: string) {
  const sourceFoods = uniqueAiFoods(foods ?? []);
  if (!isGenericDiningDescription(description)) return sourceFoods;

  const filtered = sourceFoods.filter((food) => isFoodSupportedByDescription(food, description));
  return filtered.length ? filtered : sourceFoods;
}

function isFoodSupportedByDescription(food: AiFood, description: string) {
  const text = normalizeSearchText(description);
  const foodText = normalizeSearchText(`${food.brand ?? ""}${food.foodType ?? ""}${food.name ?? ""}${food.portionLabel ?? ""}`);

  const strictTokens = [
    "半份饭",
    "米饭",
    "拌饭",
    "石锅饭",
    "生菜包",
    "生菜",
    "金针菇",
    "冷面",
    "泡菜",
    "宽粉",
    "粉丝",
    "豆腐皮",
    "豆腐",
    "土豆",
    "娃娃菜",
    "薯条",
    "可乐"
  ];

  return strictTokens.every((token) => {
    if (!foodText.includes(token)) return true;
    if (text.includes(token)) return true;
    if (token === "米饭" && /米饭|盖饭|盖浇饭|拌饭|石锅饭/.test(text)) return true;
    return false;
  });
}

export function applyBrandCatalogToAiFood(food: AiFood, description: string): AiFood {
  const match = findFoodBrandMatches(description, 1)[0];
  if (!match) return food;

  const shouldUseCatalogBrand = shouldFillBrandFromCatalog(food.brand) || isBrandAliasForMatch(food.brand, match);
  if (!shouldUseCatalogBrand) return food;

  return {
    ...food,
    brand: match.brand,
    recognitionMode: food.recognitionMode ?? "industry-average",
    warning: food.warning
  };
}

function shouldFillBrandFromCatalog(brand?: string) {
  const text = normalizeSearchText(brand ?? "");
  if (!text) return true;
  return /未识别|未知|无品牌|行业平均|同品类平均/.test(text);
}

function isBrandAliasForMatch(brand: string | undefined, match: { brand: string; aliases: string[] }) {
  const text = normalizeSearchText(brand ?? "");
  if (!text) return false;
  const names = [match.brand, ...match.aliases].map(normalizeSearchText);
  return names.includes(text);
}

export function parseAiPayload(content: unknown): AiPayload {
  if (content && typeof content === "object" && !Array.isArray(content)) return content as AiPayload;
  if (typeof content !== "string") return {};
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  try {
    return JSON.parse(cleaned) as AiPayload;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as AiPayload;
    } catch {
      return {};
    }
  }
}

function isChineseText(value?: string) {
  return Boolean(value && /[\u4e00-\u9fff]/.test(value));
}

function chineseOrDefault(value: string | undefined, fallback: string) {
  return value && isChineseText(value) ? value : fallback;
}

const genericVenuePrefix = /^(?:楼下|楼上|隔壁|附近|门口|对面|路边|街边|小区|公司|单位|学校|医院|宿舍|家里|家附近|自家|自己|某|一家|这家|那家|(?:the\s+)?(?:downstairs|nearby|local|office|school|company|home)\b)/i;
const genericVenueName = /^(?:食堂|外卖|面馆|饭店|饭馆|餐厅|餐馆|小吃店|快餐店|便利店|家常|家常菜|自制|自己做的?|路边摊|大排档|夜市|cafeteria|canteen|takeout|takeaway|homemade)$/i;

/** “楼下面馆”“公司食堂”: a place or kind of shop, not a brand. Such names are not stored as brands. */
export function isGenericVenue(brand?: string) {
  const text = (brand ?? "").trim();
  return Boolean(text) && (genericVenuePrefix.test(text) || genericVenueName.test(text));
}

export function normalizeFood(food: AiFood, source: "ai-text", language: Language = "zh"): FoodLogItem {
  const macros = normalizeMacros(food.macros);
  const genericBrand = isGenericVenue(food.brand) || isGenericVenue(food.brandZh) || isGenericVenue(food.brandEn);

  const baseName = food.name?.trim() || localized(language, "AI 识别食物", "AI recognized food");
  const baseBrand = (!genericBrand && food.brand?.trim()) || localized(language, "未识别品牌", "Unknown brand");
  const baseFoodType = food.foodType?.trim() || localized(language, "食品", "Food");
  const basePortionLabel = food.portionLabel?.trim() || localized(language, "AI 估算份量", "AI estimated portion");
  const warning = food.warning?.trim() || "";

  const nameZh = chineseOrDefault(food.nameZh?.trim(), language === "zh" ? baseName : translateToZh(baseName));
  const nameEn = food.nameEn?.trim() || (language === "en" ? baseName : translateToEn(nameZh));
  const brandZh = chineseOrDefault(genericBrand ? undefined : food.brandZh?.trim(), language === "zh" ? baseBrand : translateToZh(baseBrand));
  const brandEn = (!genericBrand && food.brandEn?.trim()) || (language === "en" ? baseBrand : translateToEn(brandZh));
  const foodTypeZh = chineseOrDefault(food.foodTypeZh?.trim(), language === "zh" ? baseFoodType : translateToZh(baseFoodType));
  const foodTypeEn = food.foodTypeEn?.trim() || (language === "en" ? baseFoodType : translateToEn(foodTypeZh));
  const portionLabelZh = chineseOrDefault(food.portionLabelZh?.trim(), language === "zh" ? basePortionLabel : translateToZh(basePortionLabel));
  const portionLabelEn = food.portionLabelEn?.trim() || (language === "en" ? basePortionLabel : translateToEn(portionLabelZh));
  const warningZh = warning ? chineseOrDefault(food.warningZh?.trim(), language === "zh" ? warning : translateToZh(warning)) : "";
  const warningEn = food.warningEn?.trim() || (warning ? (language === "en" ? warning : translateToEn(warningZh)) : "");
  const sourceLabelZh = localized("zh", "AI 识别", "AI recognition");
  const sourceLabelEn = localized("en", "AI 识别", "AI recognition");

  return {
    id: id("ai-food"),
    name: language === "en" ? nameEn : nameZh,
    brand: language === "en" ? brandEn : brandZh,
    foodType: language === "en" ? foodTypeEn : foodTypeZh,
    portionLabel: language === "en" ? portionLabelEn : portionLabelZh,
    portionScale: 1,
    baseMacros: macros,
    macros,
    meal: food.meal && mealValues.includes(food.meal) ? food.meal : "snack",
    warning: language === "en" ? warningEn : warningZh,
    source,
    recognitionMode: food.recognitionMode === "brand-product" ? "brand-product" : "industry-average",
    sourceLabel: language === "en" ? sourceLabelEn : sourceLabelZh,
    loggedAt: new Date().toISOString(),
    nameZh,
    nameEn,
    brandZh,
    brandEn,
    foodTypeZh,
    foodTypeEn,
    portionLabelZh,
    portionLabelEn,
    warningZh,
    warningEn,
    sourceLabelZh,
    sourceLabelEn
  };
}

function normalizeMacros(macros?: Partial<MacroTotals>): MacroTotals {
  return normalizeMacroTotals(macros as Record<string, unknown> | null | undefined);
}
