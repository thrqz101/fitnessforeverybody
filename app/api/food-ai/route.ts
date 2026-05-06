import { foodCatalog, type FoodCatalogItem } from "@/lib/food-catalog";
import {
  buildFoodBrandSearchQuery,
  findFoodBrandMatches,
  getBrandCatalogPrompt,
  hasFoodBrandMatch
} from "@/lib/brand-catalog";
import type { FoodLogItem, MacroTotals, MealType } from "@/lib/types";

export const runtime = "nodejs";

type AiFood = {
  name?: string;
  brand?: string;
  foodType?: string;
  portionLabel?: string;
  meal?: MealType;
  macros?: Partial<MacroTotals>;
  recognitionMode?: "brand-product" | "industry-average";
  warning?: string;
};

type AiPayload = {
  isFoodRelated?: boolean;
  message?: string;
  foods?: AiFood[];
};

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type TavilySearchPayload = {
  results?: TavilySearchResult[];
  answer?: string;
};

type ProviderConfig = {
  name: "minimax" | "dashscope" | "openai";
  apiKey: string;
  baseUrl: string;
  model: string;
  supportsImages: boolean;
};

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const mealValues: MealType[] = ["breakfast", "lunch", "dinner", "snack", "midnight"];

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const description = String(form.get("description") ?? "").trim();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);

    if (!files.length && isVagueFoodDescription(description)) {
      return Response.json({
        ok: true,
        isFoodRelated: false,
        foods: [],
        message: "你还没告诉我具体吃了什么喔。可以写成“肯德基香辣鸡腿堡 + 中薯 + 无糖可乐”这种，我再帮你估算。"
      });
    }

    const provider = getProviderConfig();

    if (!provider) {
      return Response.json(
        {
          ok: false,
          needsConfig: true,
          message: "AI 解析还没配置。请先在部署平台里检查 AI 服务环境变量；如果要开放拍照识别，再添加支持视觉的 AI 服务。"
        },
        { status: 503 }
      );
    }

    if (description && shouldSearchNutrition(description)) {
      const searchContext = await searchNutritionWithTavily(description);
      if (searchContext) {
        const searchedPayload = await extractAiPayloadFromSearch(provider, description, searchContext);
        if (searchedPayload.isFoodRelated && searchedPayload.foods?.length) {
          return Response.json({
            ok: true,
            provider: "tavily-ai",
            isFoodRelated: true,
            message: searchedPayload.message || "我先查了公开营养信息，再帮你整理好了；右侧数值可以继续手动微调。",
            foods: searchedPayload.foods.map((food) => normalizeFood(applyBrandCatalogToAiFood(food, description), "ai-text"))
          });
        }
      }
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/")).slice(0, 6);

    if (!provider.supportsImages && imageFiles.length && !description) {
      return Response.json({
        ok: true,
        isFoodRelated: false,
        foods: [],
        message: "先在右侧写一下这餐吃了什么喔，我会按你的描述帮你估算。"
      });
    }

    const imageParts = provider.supportsImages
      ? await Promise.all(
          imageFiles.map(async (file) => ({
            type: "image_url",
            image_url: { url: await fileToDataUrl(file) }
          }))
        )
      : [];

    if (!imageParts.length && !description) {
      return Response.json(
        { ok: false, message: "先写一下你吃了什么，我再帮你把营养素估出来。" },
        { status: 400 }
      );
    }

    const skippedFiles = files
      .filter((file) => !file.type.startsWith("image/") || !provider.supportsImages)
      .map((file) => file.name);
    const prompt = [
      "你是中国餐饮场景的自然语言营养估算助手。只返回严格 JSON 对象，不要 Markdown，不要解释。",
      "任务：根据用户本次文字描述和/或图片，把每个食物拆成 foods，并估算营养素。",
      "如果用户没有说具体食物、品牌、菜品、套餐、配料或份量，例如只说“我今天吃什么”，返回 isFoodRelated=false 和空 foods，不要硬猜。",
      "品牌+产品优先；识别不出品牌时，用同品类行业平均估算，recognitionMode=industry-average。",
      "如果用户文字里出现疑似品牌名或门店名，不要把 brand 留空；brand 填用户写出的品牌/门店，warning 说明是否查到公开资料。",
      getBrandCatalogPrompt(description),
      "普通自然语言描述优先按中国餐饮行业平均估算，不要套用固定菜单模板。",
      "严格只按用户写出的食物、配菜、主食和饮料估算；用户没有写到的米饭、冷面、金针菇、生菜、薯条、饮料等，不要自行添加。",
      "不要把不完全一致的组合当成同一种食物；例如“鱼香肉丝盖浇饭”不是“鱼香肉丝 + 番茄炒蛋 + 米饭”，除非用户也明确说点了番茄炒蛋。",
      "遇到盖饭、盖浇饭、粉面、麻辣烫、火锅、素菜拼盘、套餐时，严格按用户实际写出的主食、配菜、饮料和份量估算。",
      "遇到韩式烤肉、火锅、麻辣烫这类一餐里有多个部分的描述时，不能生成互相包含的重复套餐；例如主烤肉组合、冷面、泡菜应拆成不重叠条目，或者合成一个完整组合。",
      getChinesePortionBaselinePrompt(),
      "多食物必须拆开，例如汉堡、薯条、可乐、奶茶小料、麻辣烫配菜都要分项。",
      "每个 food 必须有 name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
      "macros 包含 protein/carbs/fat/calories/fiber，单位 g/g/g/kcal/g，四舍五入为整数。",
      "自检：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正宏量营养素或热量。",
      "返回格式：{\"isFoodRelated\":true,\"message\":\"识别好了\",\"foods\":[{\"name\":\"香辣鸡腿堡\",\"brand\":\"肯德基\",\"foodType\":\"汉堡\",\"portionLabel\":\"1 个\",\"meal\":\"lunch\",\"macros\":{\"protein\":23,\"carbs\":42,\"fat\":18,\"calories\":430,\"fiber\":2},\"recognitionMode\":\"brand-product\",\"warning\":\"按常见门店份量估算\"}]}",
      `用户手动描述：${description || "无"}`,
      provider.supportsImages ? "" : "当前接入的是文本模型，不支持直接读取图片。请只根据用户文字描述解析食物。",
      skippedFiles.length ? `这些文件暂未送入视觉模型：${skippedFiles.join("、")}` : ""
    ].filter(Boolean).join("\n");
    const userContent = provider.supportsImages
      ? [
          { type: "text", text: prompt },
          ...imageParts
        ]
      : prompt;

    const requestBody = JSON.stringify({
      model: provider.model,
      temperature: 0,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content: "你只输出可以被 JSON.parse 解析的 JSON。估算要稳定，同一句输入保持同一套常见份量假设。"
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });
    const { response, errorText } = await requestChatCompletion(provider, requestBody);

    if (!response?.ok) {
      const exactLocalResult = buildExactLocalResult(description);
      if (exactLocalResult) return Response.json(exactLocalResult);

      return Response.json(
        { ok: false, message: `AI 服务暂时没有识别成功：${response?.status ?? 502} ${errorText.slice(0, 180)}` },
        { status: response?.status ?? 502 }
      );
    }

    const json = await response.json();
    const content = extractAssistantContent(json);
    let parsed = parseAiPayload(content);

    if (shouldRepairAiPayload(parsed, content, description)) {
      parsed = await repairAiPayload(provider, description, content, parsed);
    }

    if (!parsed.isFoodRelated || !parsed.foods?.length) {
      const exactLocalResult = buildExactLocalResult(description);
      if (exactLocalResult) return Response.json(exactLocalResult);

      return Response.json({
        ok: true,
        isFoodRelated: false,
        message: imageParts.length && !description
          ? parsed.message || "这张不像食物喔，给我看看你今天都吃了些什么？"
          : parsed.message || "我没算准这餐，可以再补充品牌、主食、配菜或份量。",
        foods: []
      });
    }

    const source = provider.supportsImages && imageParts.length ? "ai-vision" : "ai-text";
    const cleanedFoods = cleanAiFoodsForDescription(parsed.foods, description);
    const foods = cleanedFoods.map((food) => normalizeFood(applyBrandCatalogToAiFood(food, description), source));
    return Response.json({
      ok: true,
      provider: "ai",
      isFoodRelated: true,
      message: parsed.message || "识别好了，右侧数值可以继续手动微调。",
      foods
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "AI 识别遇到未知错误。" },
      { status: 500 }
    );
  }
}

function getProviderConfig(): ProviderConfig | null {
  const requestedProvider = process.env.AI_PROVIDER?.toLowerCase();

  if ((requestedProvider === "minimax" || !requestedProvider) && process.env.MINIMAX_API_KEY) {
    return {
      name: "minimax",
      apiKey: process.env.MINIMAX_API_KEY,
      baseUrl: process.env.AI_BASE_URL || process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1",
      model: process.env.AI_MODEL || "MiniMax-M2.7-highspeed",
      supportsImages: false
    };
  }

  if ((requestedProvider === "dashscope" || !requestedProvider) && process.env.DASHSCOPE_API_KEY) {
    return {
      name: "dashscope",
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseUrl: process.env.AI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: process.env.AI_MODEL || "qwen3-vl-plus",
      supportsImages: true
    };
  }

  if ((requestedProvider === "openai" || !requestedProvider) && process.env.OPENAI_API_KEY) {
    return {
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.AI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.AI_MODEL || "gpt-4o-mini",
      supportsImages: true
    };
  }

  return null;
}

function isVagueFoodDescription(description: string) {
  const text = description.replace(/\s+/g, "");
  if (!text) return false;
  if (text.length <= 12 && /^(我)?(今天|早上|中午|晚上)?(吃什么|吃啥|吃点啥|吃点什么|该吃什么)[？?。!！]*$/.test(text)) return true;

  const foodSignals = /饭|面|粉|粥|包子|馒头|饺子|馄饨|汉堡|薯条|可乐|鸡|牛|猪|鱼|虾|肉|蛋|奶|豆腐|蔬菜|青菜|火锅|麻辣烫|冒菜|烧烤|烤肉|牛排|寿司|沙拉|奶茶|咖啡|水果|香蕉|苹果|肯德基|麦当劳|汉堡王|海底捞|瑞幸|星巴克|喜茶|奈雪|蜜雪|茶百道|古茗|全家|罗森|711|便利店/.test(text);
  return text.length < 10 && !foodSignals;
}

function shouldRepairAiPayload(parsed: AiPayload, content: unknown, description: string) {
  if (!description || isVagueFoodDescription(description)) return false;
  if (parsed.isFoodRelated && parsed.foods?.length) return false;
  if (typeof content !== "string") return false;
  return /[\{\[]/.test(content);
}

const localFoodRules: Array<{
  test: RegExp;
  food: AiFood;
}> = [
  {
    test: /白菜.*(鲜肉)?饺子|饺子.*白菜|水饺/,
    food: {
      name: "白菜鲜肉饺子",
      brand: "饺子馆 / 行业平均",
      foodType: "饺子",
      portionLabel: "正常一份",
      meal: "lunch",
      macros: { protein: 28, carbs: 78, fat: 22, calories: 620, fiber: 5 },
      recognitionMode: "industry-average",
      warning: "按常见白菜鲜肉水饺一份估算；如果个头特别大或特别小，可以在右侧改。"
    }
  },
  {
    test: /素菜拼盘|蔬菜拼盘|素菜.*拼|蔬菜.*拼/,
    food: {
      name: "素菜拼盘",
      brand: "素菜拼盘 / 行业平均",
      foodType: "素菜",
      portionLabel: "正常一盘",
      meal: "lunch",
      macros: { protein: 16, carbs: 48, fat: 18, calories: 415, fiber: 12 },
      recognitionMode: "industry-average",
      warning: "按藕片、黄瓜、花生、豆制品等混合素菜拼盘估算；油拌和花生会让脂肪更高。"
    }
  },
  {
    test: /麻辣烫|冒菜/,
    food: {
      name: "麻辣烫混合碗",
      brand: "麻辣烫 / 行业平均",
      foodType: "麻辣烫",
      portionLabel: "正常一碗",
      meal: "lunch",
      macros: { protein: 34, carbs: 58, fat: 24, calories: 610, fiber: 9 },
      recognitionMode: "industry-average",
      warning: "按少量主食、豆制品、丸子和蔬菜估算；麻酱和宽粉多的话热量会更高。"
    }
  },
  {
    test: /盖浇饭|盖饭|鸡腿饭|猪脚饭|黄焖鸡/,
    food: {
      name: "盖浇饭",
      brand: "中式快餐 / 行业平均",
      foodType: "盖饭",
      portionLabel: "正常一份",
      meal: "lunch",
      macros: { protein: 36, carbs: 86, fat: 26, calories: 720, fiber: 6 },
      recognitionMode: "industry-average",
      warning: "按一份米饭和一份肉菜估算；加蛋、加肉或大份米饭会更高。"
    }
  },
  {
    test: /火锅|海底捞|巴奴|呷哺/,
    food: {
      name: "火锅常规组合",
      brand: "火锅 / 行业平均",
      foodType: "火锅",
      portionLabel: "正常一餐",
      meal: "dinner",
      macros: { protein: 54, carbs: 35, fat: 38, calories: 700, fiber: 9 },
      recognitionMode: "industry-average",
      warning: "按肉类、豆制品、蔬菜和少量主食估算；油碟、麻酱、酥肉会显著增加脂肪。"
    }
  }
];

function buildExactLocalResult(description: string) {
  if (!canUseExactLocalFallback(description)) return null;

  const exactLocalFoods = estimateFoodsFromExactLocalKnowledge(description);
  if (!description || !exactLocalFoods.length) return null;

  return {
    ok: true,
    provider: "local-food-library",
    isFoodRelated: true,
    message: "这个组合和本地食物库完全对上了，先按库里数值兜底估算；右侧还可以继续手动微调。",
    foods: exactLocalFoods.map((food) => normalizeFood(food, "ai-text"))
  };
}

function canUseExactLocalFallback(description: string) {
  const text = normalizeSearchText(description);
  if (!text) return false;

  const looksLikeDetailedMeal = /点了|主要有|里面有|还吃|还喝|另外|再加|加了|配了|包含|还有|其中|分别|；|;/.test(description);
  if (looksLikeDetailedMeal) return false;

  return true;
}

function estimateFoodsFromExactLocalKnowledge(description: string): AiFood[] {
  const text = normalizeSearchText(description);
  if (!text) return [];

  const exactFoods = foodCatalog
    .filter((item) => isExactCatalogFoodMatch(item, text))
    .slice(0, 4)
    .map((item) => catalogItemToAiFood(item));

  return uniqueAiFoods(exactFoods).slice(0, 4);
}

function isExactCatalogFoodMatch(item: FoodCatalogItem, text: string) {
  const title = normalizeSearchText(item.title);
  if (title.length >= 4 && text.includes(title)) return true;

  const titleTokens = splitSearchTokens(item.title)
    .map(cleanExactFoodToken)
    .filter((token) => token.length >= 2 && !isLooseExactToken(token));
  if (titleTokens.length >= 2 && titleTokens.every((token) => isExactTokenPresent(token, text))) {
    return true;
  }

  const itemTokens = item.items
    .flatMap((part) => splitSearchTokens(part))
    .map(cleanExactFoodToken)
    .filter((token) => token.length >= 2 && !isLooseExactToken(token));
  return itemTokens.length >= 2 && itemTokens.every((token) => isExactTokenPresent(token, text));
}

function cleanExactFoodToken(token: string) {
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

function hasSimilarRuleFood(item: FoodCatalogItem, ruleFoods: AiFood[]) {
  const itemText = normalizeSearchText(`${item.title}${item.foodType}${item.items.join("")}${item.aliases.join("")}`);
  return ruleFoods.some((food) => {
    const foodType = normalizeSearchText(food.foodType ?? "");
    const foodName = normalizeSearchText(food.name ?? "");
    if (foodType && itemText.includes(foodType)) return true;
    if (foodName && itemText.includes(foodName)) return true;
    if (foodType === "素菜" && /素菜|蔬菜|拼盘/.test(itemText)) return true;
    return false;
  });
}

function hasStrongCatalogMatch(item: FoodCatalogItem, text: string) {
  const fields = [
    item.brand,
    item.title,
    ...item.aliases,
    ...item.items
  ];

  return fields.some((field) => {
    for (const token of splitSearchTokens(field)) {
      if (token.length < 3) continue;
      if (isGenericFoodToken(token)) continue;
      if (text.includes(token)) return true;
    }
    return false;
  });
}

function splitSearchTokens(value: string) {
  return normalizeSearchText(value)
    .split(/[/／+＋、，,;；:：|｜\s]+/)
    .filter(Boolean);
}

function isGenericFoodToken(token: string) {
  return /^(咖啡|拿铁|奶茶|汉堡|米饭|面条|粉面|饮料|茶饮|水果|蔬菜|青菜|牛肉|鸡肉|猪肉|豆腐|酸奶|沙拉|蛋白|套餐|快餐)$/.test(token);
}

function scoreCatalogItem(item: FoodCatalogItem, text: string) {
  const aliases = item.aliases ?? [];
  const fields = [
    item.brand,
    item.title,
    item.foodType,
    ...item.items,
    ...aliases
  ].map(normalizeSearchText).filter(Boolean);

  let score = 0;
  for (const field of fields) {
    if (!field || field.length < 2) continue;
    if (text.includes(field)) score += field.length >= 4 ? 5 : 3;
  }

  for (const token of splitCatalogTokens(item)) {
    if (token.length >= 2 && text.includes(token)) score += 1;
  }

  return score;
}

function splitCatalogTokens(item: FoodCatalogItem) {
  return normalizeSearchText(`${item.brand} ${item.title} ${item.foodType} ${item.items.join(" ")} ${item.aliases.join(" ")}`)
    .split(/[/／+＋、，,;；:：|｜\s]+/)
    .filter((token) => token.length >= 2);
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

function uniqueAiFoods(foods: AiFood[]) {
  const seen = new Set<string>();
  return foods.filter((food) => {
    const key = normalizeSearchText(`${food.brand ?? ""}${food.name ?? ""}${food.foodType ?? ""}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanAiFoodsForDescription(foods: AiFood[] | undefined, description: string) {
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

function applyBrandCatalogToAiFood(food: AiFood, description: string): AiFood {
  const match = findFoodBrandMatches(description, 1)[0];
  if (!match) return food;

  const shouldUseCatalogBrand = shouldFillBrandFromCatalog(food.brand) || isBrandAliasForMatch(food.brand, match);
  if (!shouldUseCatalogBrand) return food;

  return {
    ...food,
    brand: match.brand,
    recognitionMode: "brand-product",
    warning: [food.warning, "品牌来自品牌库命中；营养值按公开信息或同品类份量估算。"].filter(Boolean).join("；")
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

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function getChinesePortionBaselinePrompt() {
  return [
    "中国餐饮份量基准：",
    "1. 口径先分清生重/熟重。熟白米饭约 116 kcal/100g、碳水约 26g/100g；生米约 75-80g 碳水/100g，不能把熟米饭按生米计算。",
    "2. 一碗家用熟米饭通常按 150-200g；外卖盖饭/盖浇饭默认米饭 250-320g，小份/半份 150-200g，大份 350-420g。盖浇饭总碳水通常至少包含米饭碳水，再叠加酱汁、淀粉和配菜。",
    "3. 普通粉面/米线/拉面一碗默认主食熟重 250-350g；凉皮/米皮/擀面皮一份默认 350-450g，碳水通常 70-100g，若有肉夹馍或饮料要拆开另算。",
    "4. 麻辣烫/冒菜一碗默认可食固体 350-550g；有宽粉、土豆、方便面、粉丝时碳水上调；只选蔬菜和豆制品时碳水下调、蛋白按豆制品/肉丸估。",
    "5. 饺子/馄饨按数量估：普通饺子 20-25g/个，10-15 个是一人份；小馄饨更轻，大馄饨更重。",
    "6. 单人炒菜盖饭的浇头默认 180-250g；单点一盘炒菜默认 250-400g 且可能多人分享。中式炒菜通常含 10-25g 烹调油，鱼香、糖醋、红烧、干锅、烧烤、油炸要上调脂肪或糖。",
    "7. 单人正餐肉/禽/鱼/蛋可食部分默认 100-180g；蔬菜一份默认 150-250g；水果一个/一份默认 150-250g。",
    "8. 奶茶、咖啡和饮料必须按糖度、奶盖、小料拆分；用户没写糖度时按正常糖估，并在 warning 提醒可微调。",
    "9. 如果用户给出明确克数、个数、杯型或大小份，优先用用户份量；否则按以上中国餐饮默认份量估算，并在 portionLabel 写明假设。"
  ].join("\n");
}

function shouldSearchNutrition(description: string) {
  const text = normalizeSearchText(description);
  if (text.length < 3) return false;
  if (hasFoodBrandMatch(description)) return true;
  if (isGenericDiningDescription(description)) return false;
  if (text.length < 6) return false;
  if (looksLikeBrandProductDescription(text)) return true;
  return /[A-Za-z]/.test(description) && /(营养|热量|套餐|汉堡|奶茶|咖啡|披萨|三明治|蛋糕|饮料|产品|口味)/.test(description);
}

function looksLikeBrandProductDescription(text: string) {
  if (isGenericDiningText(text)) return false;

  const foodOrProductSignal = /(套餐|招牌|菜单|门店|官方|营养|热量|汉堡|凉皮|米皮|擀面皮|肉夹馍|盖饭|盖浇饭|拌饭|拉面|小面|米线|酸辣粉|粉面|饺子|水饺|云饺|馄饨|包子|火锅|烤肉|烧烤|炸鸡|鸡排|披萨|咖啡|奶茶|茶饮|牛肉饭|便当|鸡腿饭|卤肉饭)/;
  const brandShape = /[\u4e00-\u9fa5]{1,8}(家|记|王|嫂|哥|姐|叔|爷|婆|府|轩|馆|店|斋|楼|村|坊|巷|捞|凉皮|肉夹馍|汉堡|炸鸡|咖啡|茶|茶姬|拌饭|拉面|米线|水饺|云饺|馄饨|烤肉|烧烤)/;
  return foodOrProductSignal.test(text) && brandShape.test(text);
}

function isGenericDiningDescription(description: string) {
  if (hasFoodBrandMatch(description)) return false;
  return isGenericDiningText(normalizeSearchText(description));
}

function isGenericDiningText(text: string) {
  return /(韩式烤肉|烤肉店|烤肉|烧烤|火锅|麻辣烫|冒菜|盖饭|盖浇饭|粉面|快餐|炒菜|素菜拼盘|蔬菜拼盘)/.test(text);
}

async function searchNutritionWithTavily(description: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: buildFoodBrandSearchQuery(description),
        topic: "general",
        search_depth: "basic",
        max_results: 6,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        country: "china"
      })
    });

    if (!response.ok) return "";
    const payload = await response.json() as TavilySearchPayload;
    const results = (payload.results ?? [])
      .filter((result) => result.title || result.content)
      .slice(0, 5);

    if (!results.length) return "";

    return results
      .map((result, index) => {
        const source = result.url ? `来源：${result.url}` : "来源：未知";
        return `#${index + 1} ${result.title ?? "未命名结果"}\n${source}\n摘要：${(result.content ?? "").slice(0, 700)}`;
      })
      .join("\n\n");
  } catch {
    return "";
  }
}

async function extractAiPayloadFromSearch(provider: ProviderConfig, description: string, searchContext: string): Promise<AiPayload> {
  const prompt = [
    "你是营养信息结构化助手。只返回严格 JSON 对象，不要 Markdown，不要解释。",
    "任务：根据用户食物描述和搜索结果，提取或估算每个食物的营养素。",
    "优先使用搜索结果中的品牌、产品、菜单、营养成分信息；如果搜索结果没有精确数值，但能确认食物类型，可结合行业平均估算。",
    "如果搜索结果只找到品牌菜单或产品介绍，没有营养表，也要保留用户写出的品牌名，并结合中国餐饮份量基准估算。",
    "严格只按用户写出的食物和份量估算；不要补充用户没写的配菜、主食或饮料。",
    getBrandCatalogPrompt(description),
    getChinesePortionBaselinePrompt(),
    "多食物必须拆分。每个 food 必须有 name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
    "不能生成互相包含的重复套餐；同一份肉、主食或配菜只能算一次。",
    "macros 包含 protein/carbs/fat/calories/fiber，单位 g/g/g/kcal/g，四舍五入为整数。",
    "自检：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正。",
    "warning 里用一句中文说明依据，例如“参考公开搜索结果并按常见份量估算，可手动微调”。",
    '输出格式：{"isFoodRelated":true,"message":"已参考公开信息估算","foods":[{"name":"产品名","brand":"品牌","foodType":"类型","portionLabel":"正常一份","meal":"lunch","macros":{"protein":20,"carbs":30,"fat":10,"calories":300,"fiber":3},"recognitionMode":"brand-product","warning":"参考公开搜索结果估算"}]}',
    `用户描述：${description}`,
    `搜索结果：\n${searchContext}`
  ].join("\n");

  try {
    const { response } = await requestChatCompletion(
      provider,
      JSON.stringify({
        model: provider.model,
        temperature: 0,
        max_tokens: 1300,
        messages: [
          {
            role: "system",
            content: "你只输出可以被 JSON.parse 解析的 JSON 对象。"
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    );

    if (!response?.ok) return {};
    const json = await response.json();
    return parseAiPayload(extractAssistantContent(json));
  } catch {
    return {};
  }
}

async function repairAiPayload(provider: ProviderConfig, description: string, firstContent: unknown, fallback: AiPayload) {
  const repairPrompt = [
    "你是食物营养 JSON 结构化器。只返回严格 JSON 对象，不要 Markdown，不要解释。",
    "用户描述的是食物时，必须返回 isFoodRelated=true，并把不同食物拆成 foods 数组。",
    "如果用户写了疑似品牌或门店名，brand 必须填这个品牌/门店名，不要写未识别品牌。",
    "严格只按用户写出的食物和份量估算；不要补充用户没写的配菜、主食或饮料，也不要生成互相包含的重复套餐。",
    getBrandCatalogPrompt(description),
    getChinesePortionBaselinePrompt(),
    "每个 food 必须有 name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
    "macros 必须包含 protein/carbs/fat/calories/fiber，单位分别是 g/g/g/kcal/g，数值用合理估算。",
    "自检：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正。",
    "如果品牌或具体产品能从文本识别出来，recognitionMode 用 brand-product；否则用 industry-average。",
    '输出格式示例：{"isFoodRelated":true,"message":"识别好了","foods":[{"name":"香辣鸡腿堡","brand":"肯德基","foodType":"汉堡","portionLabel":"1 个","meal":"lunch","macros":{"protein":23,"carbs":42,"fat":18,"calories":430,"fiber":2},"recognitionMode":"brand-product","warning":"按常见门店份量估算"}]}',
    `用户描述：${description}`,
    `第一轮模型输出：${stringifyForPrompt(firstContent)}`
  ].join("\n");

  try {
    const { response } = await requestChatCompletion(
      provider,
      JSON.stringify({
        model: provider.model,
        temperature: 0,
        max_tokens: 1100,
        messages: [
          {
            role: "system",
            content: "你只输出可以被 JSON.parse 解析的 JSON 对象。"
          },
          {
            role: "user",
            content: repairPrompt
          }
        ]
      })
    );

    if (!response?.ok) return fallback;
    const json = await response.json();
    const repaired = parseAiPayload(extractAssistantContent(json));
    return repaired.isFoodRelated || repaired.foods?.length ? repaired : fallback;
  } catch {
    return fallback;
  }
}

function extractAssistantContent(json: unknown): unknown {
  if (!json || typeof json !== "object") return undefined;
  const data = json as {
    choices?: Array<{
      text?: unknown;
      message?: {
        content?: unknown;
      };
      delta?: {
        content?: unknown;
      };
    }>;
    output_text?: unknown;
    content?: unknown;
  };
  const choice = data.choices?.[0];
  return choice?.message?.content ?? choice?.text ?? choice?.delta?.content ?? data.output_text ?? data.content;
}

function stringifyForPrompt(value: unknown) {
  if (typeof value === "string") return value.slice(0, 1800);
  try {
    return JSON.stringify(value).slice(0, 1800);
  } catch {
    return "";
  }
}

async function requestChatCompletion(provider: ProviderConfig, body: string) {
  let lastResponse: Response | null = null;
  let lastErrorText = "";

  for (const endpoint of getChatCompletionUrls(provider.baseUrl)) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body
    });

    if (response.ok) return { response, errorText: "" };

    lastResponse = response;
    lastErrorText = await response.text();

    if (response.status !== 404 && response.status !== 405) {
      return { response, errorText: lastErrorText };
    }
  }

  return { response: lastResponse, errorText: lastErrorText };
}

function getChatCompletionUrls(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return [trimmed];

  const urls: string[] = [];

  try {
    const parsed = new URL(trimmed);
    const hasPath = parsed.pathname !== "/";
    if (!hasPath) urls.push(`${trimmed}/v1/chat/completions`);
  } catch {
    return [`${trimmed}/chat/completions`];
  }

  urls.push(`${trimmed}/chat/completions`);
  return Array.from(new Set(urls));
}

async function fileToDataUrl(file: File) {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error(`${file.name} 超过 8MB，先压缩一下再上传。`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function parseAiPayload(content: unknown): AiPayload {
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

function normalizeFood(food: AiFood, source: "ai-vision" | "ai-text"): FoodLogItem {
  const macros = normalizeMacros(food.macros);

  return {
    id: id("ai-food"),
    name: food.name?.trim() || "AI 识别食物",
    brand: food.brand?.trim() || "未识别品牌",
    foodType: food.foodType?.trim() || "食品",
    portionLabel: food.portionLabel?.trim() || "AI 估算份量",
    portionScale: 1,
    baseMacros: macros,
    macros,
    meal: food.meal && mealValues.includes(food.meal) ? food.meal : "snack",
    warning: food.warning?.trim(),
    source,
    recognitionMode: food.recognitionMode === "industry-average" ? "industry-average" : "brand-product",
    imageName: "AI 识别",
    loggedAt: new Date().toISOString()
  };
}

function normalizeMacros(macros?: Partial<MacroTotals>): MacroTotals {
  return {
    protein: safeNumber(macros?.protein),
    carbs: safeNumber(macros?.carbs),
    fat: safeNumber(macros?.fat),
    calories: safeNumber(macros?.calories),
    fiber: safeNumber(macros?.fiber)
  };
}

function safeNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : 0;
}
