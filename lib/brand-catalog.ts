import brandData from "../data/food-brands.json" with { type: "json" };

export type FoodBrandCategory =
  | "western_fast_food"
  | "chinese_fast_food"
  | "noodles_rice"
  | "hotpot"
  | "malatang"
  | "tea_coffee"
  | "snack_bakery"
  | "convenience"
  | "casual_dining";

export type FoodBrandEntry = {
  brand: string;
  aliases: string[];
  category: FoodBrandCategory;
  commonProducts: string[];
  searchTerms: string[];
  estimateHint: string;
  id: string;
  origin: "baseline" | "expansion-2026-10-13";
  nameZh?: string | null;
  nameEn?: string | null;
  contextRequiredNames: string[];
  scope: "china_priority" | "international_chain";
  homeMarket: string | null;
  verifiedMarkets: string[];
  officialDomains: string[];
  officialWebsite?: string;
  sourceStatus: "verified" | "legacy";
  sources: Array<{ url: string; kind: "official_brand" | "official_group" | "exchange_disclosure" }>;
  verifiedAt: string | null;
};

// Pending candidates stay in the data file for review and are never routed to search.
export const foodBrandCatalog = brandData.brands as FoodBrandEntry[];


export function findFoodBrandMatches(description: string, limit = 3) {
  const text = normalizeBrandText(description);
  if (!text) return [];

  return foodBrandCatalog
    .map((entry, index) => ({ entry, index, score: scoreBrandMatch(entry, description) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.entry);
}

export function hasFoodBrandMatch(description: string) {
  return findFoodBrandMatches(description, 1).length > 0;
}

export function buildFoodBrandSearchQuery(description: string) {
  // Keep the original constraints and portions; do not add unrelated menu products.
  const text = normalizeBrandText(description);
  const canonicalNames = findFoodBrandMatches(description, 2)
    .map(entry => entry.nameEn || entry.brand)
    .filter(name => !text.includes(normalizeBrandText(name)));
  return [description.trim(), ...canonicalNames, "官方营养成分 热量 蛋白质 碳水 脂肪"].join(" ");
}

export function getBrandCatalogPrompt(description: string) {
  const matches = findFoodBrandMatches(description, 3);
  if (!matches.length) return "";

  const lines = matches.map((entry) => {
    return `- ${entry.brand}：品类=${entry.category}；别名=${entry.aliases.join("、") || "无"}；常见产品=${entry.commonProducts.join("、")}；估算提示=${entry.estimateHint}`;
  });

  return [
    "品牌库命中：",
    "品牌识别不等于查到营养表。以用户明确的国家/地区、产品及份量为准；不同地区菜单营养不可直接互用。用户未注明地区时按中国市场搜索，资料不匹配时说明估算。",
    ...lines,
    "规则：用户文本命中品牌库时，brand 优先填品牌库品牌或用户原文品牌；如果公开搜索没有营养表，也要保留品牌名，并按该品牌品类与常见产品估算。"
  ].join("\n");
}

function scoreBrandMatch(entry: FoodBrandEntry, description: string) {
  const text = normalizeBrandText(description);
  const names = [entry.brand, ...entry.aliases].map(normalizeBrandText).filter(Boolean);
  let score = 0;

  for (const name of names) {
    if (name.length >= 2 && containsBrandName(description, name, entry)) {
      score = Math.max(score, name.length * 100 + (name === normalizeBrandText(entry.brand) ? 4 : 2));
    }
  }

  if (!score) return 0;

  const productText = [...entry.commonProducts, ...entry.searchTerms].map(normalizeBrandText).join(" ");
  for (const token of splitBrandTokens(productText)) {
    if (token.length >= 2 && text.includes(token)) score += 1;
  }

  return score;
}

function splitBrandTokens(value: string) {
  return value.split(/[/／+＋、，,;；:：|｜\s]+/).filter(Boolean);
}

export function normalizeBrandText(value: string) {
  return value.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'‘\s._\-‐‑–—&]+/g, "");
}

function containsBrandName(description: string, name: string, entry: FoodBrandEntry) {
  const text = normalizeBrandText(description);
  if (!text.includes(name)) return false;
  // Bare brand names can be recognized, then the router asks for a concrete product.
  if (text === name) return true;
  if (name === "全家") {
    return /全家(?:便利店|的|买|购买|饭团|便当|关东煮|三明治|咖啡)/.test(text)
      || /(?:在|去|从)全家/.test(text);
  }
  if (name === "张亮") return /张亮(?:麻辣烫|麻辣拌|的|门店)/.test(text);
  if (name === "李先生") return /李先生(?:牛肉面|的牛肉面|面馆|餐厅)|(?:在|去|从)李先生/.test(text);
  if (name === "一点点" || name === "1点点") {
    return /(?:一点点|1点点)(?:的|[一二两三\d]*杯)?(?:奶茶|红茶|绿茶|乌龙|珍珠|波霸|四季|冰淇淋|饮品|饮料)|(?:在|去|从)(?:一点点|1点点)/.test(text);
  }
  if (name === "十足") return /十足(?:便利店|的便当|的饭团)|(?:在|去|从)十足/.test(text);
  if (name === "老娘舅" && /(?:我的|我|他|她)老娘舅/.test(text)) return false;
  if (/^[a-z0-9]+$/.test(name)) {
    const escaped = Array.from(name).join("[-\\s&._'’‐‑–—]*");
    const raw = description.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    if (!new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(raw)) return false;
  }
  if (entry.contextRequiredNames.some(alias => normalizeBrandText(alias) === name)) {
    return /奶茶|咖啡|拿铁|美式|汉堡|薯条|冰淇淋|甜甜圈|三明治|饭团|便当|酸菜鱼|米饭|套餐|饮料|珍珠|波霸|milk\s*tea|coffee|latte|burger|fries|ice\s*cream|donuts?|sandwich|burrito|pizza|chicken|drink/i.test(description);
  }
  return true;
}

export function isBrandOnlyDescription(description: string, matches: FoodBrandEntry[]) {
  if (!matches.length) return false;
  if (/(?:一|1|两|2)(?:份|碗|杯|个)/.test(description) && matches.some(entry => /拉面|酸菜鱼|烤鱼|水饺|馄饨|包子|奶茶|咖啡/.test(entry.brand))) return false;
  let residual = normalizeBrandText(description);
  const names = matches.flatMap(entry => [entry.brand, ...entry.aliases])
    .map(normalizeBrandText).sort((a, b) => b.length - a.length);
  for (const name of names) residual = residual.split(name).join("");
  residual = residual
    .replace(/(?:我|我们|今天|早上|中午|晚上|刚刚|吃了|吃|喝了|喝|点了|点|买了|买|在|去|的|外卖|门店|一份|一个)/g, "")
    .replace(/(?:today|ordered|order|drank|drink|from|ate|had|have|eat|at|we|i)/g, "")
    .replace(/[\s，。！？、,.!?+＋-]/g, "");
  return !residual;
}
