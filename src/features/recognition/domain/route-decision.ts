import type { Language } from "@/shared/i18n/i18n-utils";
import { hasFoodBrandMatch, findFoodBrandMatches } from "@/features/recognition/domain/brand-catalog";
import type { AiRouteDecision, AiRouteKind, StrictLocalFoodMatch } from "@/features/recognition/domain/types";
import { parseAiPayload } from "@/features/recognition/domain/ai-foods";
import { isVagueFoodDescription } from "@/features/recognition/domain/explicit-items";
import { localized } from "@/features/recognition/domain/prompts";
import { hasMeaningfulResidualAfterLocal, normalizeSearchText, splitSearchTokens, cleanExactFoodToken } from "@/features/recognition/domain/local-match";

export function notFoodMessage(language: Language) {
  return localized(language, "我没有测出这一餐，请输入具体食物、品牌、套餐、配菜、饮料或份量。", "I couldn't identify that meal. Please enter a specific food, brand, combo, side, drink, or portion.");
}

export function parseAiRouteDecision(content: unknown): AiRouteDecision {
  const payload = parseAiPayload(content) as AiRouteDecision;
  return payload && typeof payload === "object" ? payload : {};
}

export function normalizeRouteDecision(decision: AiRouteDecision, description: string): AiRouteDecision {
  const route = decision.route;
  const validRoute: AiRouteKind =
    route === "local_exact" || route === "brand_search" || route === "ai_estimate" || route === "not_food"
      ? route
      : isVagueFoodDescription(description) || !description.trim()
        ? "not_food"
        : "ai_estimate";

  return {
    ...decision,
    isFoodRelated: decision.isFoodRelated ?? validRoute !== "not_food",
    route: validRoute
  };
}

export function buildFallbackRouteDecision(
  description: string,
  strictLocalMatches: StrictLocalFoodMatch[],
  hasFiles: boolean,
  language: Language
): AiRouteDecision {
  if (!description.trim() && !hasFiles) {
    return {
      isFoodRelated: false,
      route: "not_food",
      message: notFoodMessage(language)
    };
  }

  if (strictLocalMatches.length && !hasMeaningfulResidualAfterLocal(description, strictLocalMatches)) {
    return {
      isFoodRelated: true,
      route: "local_exact",
      reason: "路由 AI 暂时失败，使用本地严格命中兜底。"
    };
  }

  if (shouldSearchNutrition(description)) {
    return {
      isFoodRelated: true,
      route: "brand_search",
      reason: "路由 AI 暂时失败，使用品牌搜索规则兜底。"
    };
  }

  return {
    isFoodRelated: true,
    route: "ai_estimate",
    reason: "路由 AI 暂时失败，使用通用营养估算兜底。"
  };
}

export function formatStrictLocalCandidatesForRouting(matches: StrictLocalFoodMatch[]) {
  if (!matches.length) return "服务端本地库严格命中候选：无。";

  return [
    "服务端本地库严格命中候选：",
    ...matches.map((match, index) => {
      const name = `${match.food.brand ?? ""} ${match.food.name ?? match.label}`.trim();
      return `${index + 1}. ${name}；关键 token=${match.tokens.join("、")}`;
    })
  ].join("\n");
}

export function shouldUseBrandSearch(decision: AiRouteDecision, description: string) {
  if (decision.route !== "brand_search") return false;
  if (hasFoodBrandMatch(description)) return true;

  const brand = normalizeSearchText(decision.brand ?? "");
  const product = normalizeSearchText(decision.product ?? "");
  return brand.length >= 2 && product.length >= 2 && normalizeSearchText(description).includes(brand);
}

function shouldSearchNutrition(description: string) {
  const text = normalizeSearchText(description);
  if (text.length < 2) return false;
  if (isGenericDiningDescription(description)) return false;
  if (hasExplicitBrandProductDescription(description)) return true;
  if (looksLikeBrandProductDescription(text)) return true;
  return /[A-Za-z]/.test(description) && /(营养|热量|套餐|汉堡|奶茶|咖啡|披萨|三明治|蛋糕|饮料|产品|口味)/.test(description);
}

function hasExplicitBrandProductDescription(description: string) {
  const text = normalizeSearchText(description);
  const matches = findFoodBrandMatches(description, 2);
  if (!matches.length) return false;

  return matches.some((entry) => {
    const brandNames = [entry.brand, ...entry.aliases].map(normalizeSearchText).filter(Boolean);
    const hasBrand = brandNames.some((brand) => brand.length >= 2 && text.includes(brand));
    if (!hasBrand) return false;

    const productTokens = entry.commonProducts
      .flatMap(splitSearchTokens)
      .map(cleanExactFoodToken)
      .filter((token) => token.length >= 2);

    if (productTokens.some((token) => text.includes(token))) return true;

    let rest = text;
    for (const brand of brandNames.sort((a, b) => b.length - a.length)) {
      rest = rest.split(brand).join("");
    }

    return /(套餐|招牌|菜单|官方|营养|热量|汉堡|鸡腿堡|巨无霸|薯条|炸鸡|鸡翅|披萨|三明治|拿铁|奶茶|茶饮|饭团|便当|产品|口味)/.test(rest);
  });
}

function looksLikeBrandProductDescription(text: string) {
  if (isGenericDiningText(text)) return false;

  const foodOrProductSignal = /(套餐|招牌|菜单|门店|官方|营养|热量|汉堡|凉皮|米皮|擀面皮|肉夹馍|盖饭|盖浇饭|拌饭|拉面|小面|米线|酸辣粉|粉面|饺子|水饺|云饺|馄饨|包子|火锅|烤肉|烧烤|炸鸡|鸡排|披萨|咖啡|奶茶|茶饮|牛肉饭|便当|鸡腿饭|卤肉饭)/;
  const brandShape = /[\u4e00-\u9fa5]{1,8}(家|记|王|嫂|哥|姐|叔|爷|婆|府|轩|馆|店|斋|楼|村|坊|巷|捞|凉皮|肉夹馍|汉堡|炸鸡|咖啡|茶|茶姬|拌饭|拉面|米线|水饺|云饺|馄饨|烤肉|烧烤)/;
  return foodOrProductSignal.test(text) && brandShape.test(text);
}

export function isGenericDiningDescription(description: string) {
  if (hasFoodBrandMatch(description)) return false;
  return isGenericDiningText(normalizeSearchText(description));
}

function isGenericDiningText(text: string) {
  return /(韩式烤肉|烤肉店|烤肉|烧烤|火锅|麻辣烫|冒菜|盖饭|盖浇饭|粉面|快餐|炒菜|素菜拼盘|蔬菜拼盘)/.test(text);
}
