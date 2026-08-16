import { foodCatalog, type FoodCatalogItem } from "@/lib/food-catalog";
import {
  buildFoodBrandSearchQuery,
  findFoodBrandMatches,
  getBrandCatalogPrompt,
  hasFoodBrandMatch
} from "@/lib/brand-catalog";
import { normalizeLanguage, normalizeMacroTotals, pick, type Language } from "@/lib/i18n-utils";
import { translateToEn, translateToZh } from "@/lib/translations";
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
  imageNameZh?: string;
  imageNameEn?: string;
};

type AiPayload = {
  isFoodRelated?: boolean;
  message?: string;
  foods?: AiFood[];
};

type AiRouteKind = "local_exact" | "brand_search" | "ai_estimate" | "not_food";

type AiRouteDecision = {
  isFoodRelated?: boolean;
  message?: string;
  route?: AiRouteKind;
  brand?: string;
  product?: string;
  reason?: string;
  foods?: AiFood[];
};

type ChatMessage = {
  role: "system" | "user";
  content: unknown;
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
  name: "ccswitch" | "deepseek" | "minimax" | "dashscope";
  apiKey: string;
  baseUrl: string;
  model: string;
  supportsImages: boolean;
  apiStyle: "anthropic" | "openai";
};

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const mealValues: MealType[] = ["breakfast", "lunch", "dinner", "snack", "midnight"];
const tavilySearchTimeoutMs = 5_000;
const routingAiTimeoutMs = 20_000;
const searchAiTimeoutMs = 25_000;
const mainAiTimeoutMs = 35_000;
const repairAiTimeoutMs = 20_000;
const warmupAiTimeoutMs = 12_000;
const maxRecognizedFoodItems = 6;

function outputLanguageInstruction(language: Language) {
  const targetInstruction =
    language === "en"
      ? "All user-facing text fields (name, brand, foodType, portionLabel, warning, message) must be written in English."
      : "所有面向用户的字段 name、brand、foodType、portionLabel、warning、message 必须使用中文。";

  return `${targetInstruction} Also include bilingual mirror fields for every food: nameZh, nameEn, brandZh, brandEn, foodTypeZh, foodTypeEn, portionLabelZh, portionLabelEn, warningZh, warningEn, imageNameZh, imageNameEn. The Zh fields must always be Chinese; the En fields must always be English. Keep macro JSON keys as protein, carbs, fat, calories, fiber.`;
}

function localized(language: Language, zh: string, en: string) {
  return pick(language, zh, en);
}

export async function GET() {
  const provider = getProviderConfig();
  if (!provider) {
    return Response.json(
      { ok: false, needsConfig: true, message: "AI 服务还没配置好。" },
      { status: 503 }
    );
  }

  const { response, errorText } = await requestChatCompletion(
    provider,
    buildChatCompletionBody(provider, 24, [
      {
        role: "system",
        content: "只返回 JSON。"
      },
      {
        role: "user",
        content: '返回 {"ok":true}'
      }
    ]),
    warmupAiTimeoutMs
  );

  if (!response?.ok) return buildAiServiceErrorResponse(response, errorText);
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  let language: Language = "zh";

  try {
    const form = await request.formData();
    const description = String(form.get("description") ?? "").trim();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    language = normalizeLanguage(form.get("lang"));

    if (!files.length && isVagueFoodDescription(description)) {
      return Response.json({
        ok: true,
        isFoodRelated: false,
        foods: [],
        message: localized(language, "你还没告诉我具体吃了什么喔。可以写成“肯德基香辣鸡腿堡 + 中薯 + 无糖可乐”这种，我再帮你估算。", "Tell me what you ate first. For example: \"KFC spicy chicken sandwich + medium fries + sugar-free cola\", and I'll estimate it for you.")
      });
    }

    if (!files.length && exceedsExplicitFoodItemLimit(description)) {
      return buildTooManyFoodsResponse(language);
    }

    const provider = getProviderConfig();

    if (!provider) {
      return Response.json(
        {
          ok: false,
          needsConfig: true,
          message: localized(language, "AI 服务还没配置好。请检查 AI_PROVIDER、CCSWITCH_API_KEY 或 MINIMAX_API_KEY，以及模型名和 Base URL。", "The AI service is not configured. Check AI_PROVIDER, CCSWITCH_API_KEY or MINIMAX_API_KEY, plus the model name and Base URL.")
        },
        { status: 503 }
      );
    }

    const strictLocalMatches = findStrictLocalFoodMatches(description);
    const routingResult = await classifyFoodRoute(provider, description, strictLocalMatches, language);
    const routeDecision = normalizeRouteDecision(
      routingResult.ok
        ? routingResult.decision
        : buildFallbackRouteDecision(description, strictLocalMatches, Boolean(files.length), language),
      description
    );
    const hasOnlyStrictLocalMatches =
      strictLocalMatches.length > 0 &&
      !files.length &&
      !hasMeaningfulResidualAfterLocal(description, strictLocalMatches);

    if (isTooManyFoodDecision(routeDecision)) {
      return buildTooManyFoodsResponse(language);
    }

    if (!routeDecision.isFoodRelated || routeDecision.route === "not_food") {
      return Response.json({
        ok: true,
        isFoodRelated: false,
        foods: [],
        message: routeDecision.message || localized(language, "我没有测出这一餐，请输入具体食物、品牌、套餐、配菜、饮料或份量。", "I couldn't identify that meal. Please enter a specific food, brand, combo, side, drink, or portion.")
      });
    }

    if (routeDecision.route === "local_exact" && hasOnlyStrictLocalMatches) {
      return Response.json(buildStrictLocalResponse(strictLocalMatches, false, language));
    }

    if (description && shouldUseBrandSearch(routeDecision, description)) {
      const searchContext = await searchNutritionWithTavily(description);
      if (searchContext) {
        const searchedPayload = await extractAiPayloadFromSearch(provider, description, searchContext, language);
        if (searchedPayload.isFoodRelated && searchedPayload.foods?.length) {
          const foods = mergeStrictLocalAndAiFoods(strictLocalMatches, searchedPayload.foods, description, "ai-text", language);
          const tooManyResponse = buildTooManyFoodsResponseIfNeeded(foods, language);
          if (tooManyResponse) return tooManyResponse;

          return Response.json({
            ok: true,
            provider: "tavily-ai",
            isFoodRelated: true,
            message: searchedPayload.message || localized(language, "我先查了公开营养信息，再帮你整理好了；右侧数值可以继续手动微调。", "I checked public nutrition information and organized it for you; you can still fine-tune the values on the right."),
            foods
          });
        }
      }
    }

    if (routeDecision.route === "ai_estimate" && !files.length && routeDecision.foods?.length) {
      const cleanedFoods = cleanAiFoodsForDescription(routeDecision.foods, description);
      const foods = mergeStrictLocalAndAiFoods(strictLocalMatches, cleanedFoods, description, "ai-text", language);
      if (foods.length) {
        const tooManyResponse = buildTooManyFoodsResponseIfNeeded(foods, language);
        if (tooManyResponse) return tooManyResponse;

        return Response.json({
          ok: true,
          provider: "ai-fast-route",
          isFoodRelated: true,
          message: routeDecision.message || localized(language, "识别好了，已直接估算并放进草稿箱；右侧数值可以继续手动微调。", "Recognized and added to your draft tray; you can still fine-tune the values on the right."),
          foods
        });
      }
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/")).slice(0, 6);

    if (!provider.supportsImages && imageFiles.length && !description) {
      return Response.json({
        ok: true,
        isFoodRelated: false,
        foods: [],
        message: localized(language, "先在右侧写一下这餐吃了什么喔，我会按你的描述帮你估算。", "Describe what you ate first and I'll estimate the nutrients for you.")
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
        { ok: false, message: localized(language, "先写一下你吃了什么，我再帮你把营养素估出来。", "Tell me what you ate first so I can estimate the nutrients.") },
        { status: 400 }
      );
    }

    const skippedFiles = files
      .filter((file) => !file.type.startsWith("image/") || !provider.supportsImages)
      .map((file) => file.name);
    const prompt = [
      "你是中国餐饮场景的自然语言营养估算助手。只返回严格 JSON 对象，不要 Markdown，不要解释。",
      outputLanguageInstruction(language),
      "任务：根据用户本次文字描述和/或图片，把每个食物拆成 foods，并估算营养素。",
      "如果用户没有说具体食物、品牌、菜品、套餐、配料或份量，例如只说“我今天吃什么”，返回 isFoodRelated=false 和空 foods，不要硬猜。",
      "品牌+产品优先；识别不出品牌时，用同品类行业平均估算，recognitionMode=industry-average。",
      "如果用户文字里出现疑似品牌名或门店名，不要把 brand 留空；brand 填用户写出的品牌/门店，warning 说明是否查到公开资料。",
      getBrandCatalogPrompt(description),
      getStrictLocalMatchPrompt(strictLocalMatches),
      "普通自然语言描述优先按中国餐饮行业平均估算，不要套用固定菜单模板。",
      "严格只按用户写出的食物、配菜、主食和饮料估算；用户没有写到的项目不要自行添加。",
      "不要把不完全一致的组合当成同一种食物；组合餐要拆成不重叠条目，或合成一个完整组合。",
      "遇到盖饭、盖浇饭、粉面、麻辣烫、火锅、素菜拼盘、套餐时，严格按用户实际写出的主食、配菜、饮料和份量估算。",
      getChinesePortionBaselinePrompt(),
      `最多输出 ${maxRecognizedFoodItems} 个 foods；如果用户列出超过 ${maxRecognizedFoodItems} 个具体食物，返回空 foods 并提醒分批输入。`,
      "多食物必须拆开，但不要生成互相包含的重复套餐。",
      "每个 food 必须有 name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
      "macros 包含 protein/carbs/fat/calories/fiber，单位 g/g/g/kcal/g，四舍五入为整数。",
      "warning 是给用户的简短营养行动建议；高油、高糖、低纤维或精制主食偏多时，写成去皮少油、换无糖饮料、搭配蔬菜、部分主食换杂粮等具体做法；无需提醒时可为空。",
      "warning 最多 24 个中文字，不写说教或疾病判断。",
      "自检：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正宏量营养素或热量。",
      "返回 JSON 字段：isFoodRelated、message、foods；food 字段同上。",
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

    const requestBody = buildChatCompletionBody(provider, 1400, [
      {
        role: "system",
        content: "你只输出可以被 JSON.parse 解析的 JSON。估算要稳定，同一句输入保持同一套常见份量假设。"
      },
      {
        role: "user",
        content: userContent
      }
    ]);
    const { response, errorText } = await requestChatCompletion(provider, requestBody, mainAiTimeoutMs);

    if (!response?.ok) {
      if (strictLocalMatches.length) return Response.json(buildStrictLocalResponse(strictLocalMatches, true, language));

      const exactLocalResult = buildExactLocalResult(description, language);
      if (exactLocalResult) return Response.json(exactLocalResult);

      return buildAiServiceErrorResponse(response, errorText, language);
    }

    const json = await response.json();
    const content = extractAssistantContent(json);
    let parsed = parseAiPayload(content);

    if (shouldRepairAiPayload(parsed, content, description)) {
      parsed = await repairAiPayload(provider, description, content, parsed, language);
    }

    if (!parsed.isFoodRelated || !parsed.foods?.length) {
      if (strictLocalMatches.length) return Response.json(buildStrictLocalResponse(strictLocalMatches, true, language));

      const exactLocalResult = buildExactLocalResult(description, language);
      if (exactLocalResult) return Response.json(exactLocalResult);

      return Response.json({
        ok: true,
        isFoodRelated: false,
        message: imageParts.length && !description
          ? parsed.message || localized(language, "这张不像食物喔，给我看看你今天都吃了些什么？", "This doesn't look like food. Show me what you ate today.")
          : parsed.message || localized(language, "我没算准这餐，可以再补充品牌、主食、配菜或份量。", "I couldn't estimate this meal. Try adding the brand, main item, side, or portion."),
        foods: []
      });
    }

    const source = provider.supportsImages && imageParts.length ? "ai-vision" : "ai-text";
    const cleanedFoods = cleanAiFoodsForDescription(parsed.foods, description);
    const foods = mergeStrictLocalAndAiFoods(strictLocalMatches, cleanedFoods, description, source, language);
    const tooManyResponse = buildTooManyFoodsResponseIfNeeded(foods, language);
    if (tooManyResponse) return tooManyResponse;

    return Response.json({
      ok: true,
      provider: "ai",
      isFoodRelated: true,
      message: parsed.message || localized(language, "识别好了，右侧数值可以继续手动微调。", "Recognized. You can fine-tune the values on the right."),
      foods
    });
  } catch (error) {
    return buildAiServiceErrorResponse(null, error instanceof Error ? error.message : "", language);
  }
}

function getProviderConfig(): ProviderConfig | null {
  const requestedProvider = process.env.AI_PROVIDER?.toLowerCase() || "minimax";
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const ccswitchApiKey =
    process.env.CCSWITCH_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.MINIMAX_API_KEY ||
    process.env.MINIMAX_API_TOKEN;
  const openAiBaseUrl = process.env.OPENAI_BASE_URL;
  const minimaxApiKey =
    process.env.MINIMAX_API_KEY ||
    process.env.MINIMAX_API_TOKEN ||
    ((isMiniMaxBaseUrl(openAiBaseUrl) || isMiniMaxBaseUrl(process.env.AI_BASE_URL)) ? process.env.OPENAI_API_KEY : undefined);

  if (requestedProvider === "deepseek" && deepseekApiKey) {
    return {
      name: "deepseek",
      apiKey: deepseekApiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      supportsImages: false,
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "ccswitch" && ccswitchApiKey) {
    return {
      name: "ccswitch",
      apiKey: ccswitchApiKey,
      baseUrl: process.env.CCSWITCH_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://v2.aicodee.com",
      model: process.env.CCSWITCH_MODEL || process.env.ANTHROPIC_MODEL || process.env.MINIMAX_MODEL || process.env.AI_MODEL || "MiniMax-M2.7-highspeed",
      supportsImages: false,
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "minimax" && minimaxApiKey) {
    return {
      name: "minimax",
      apiKey: minimaxApiKey,
      baseUrl: process.env.MINIMAX_BASE_URL || process.env.AI_BASE_URL || (isMiniMaxBaseUrl(openAiBaseUrl) ? openAiBaseUrl : undefined) || "https://api.minimax.io/v1",
      model: process.env.MINIMAX_MODEL || process.env.AI_MODEL || "MiniMax-M2.7-highspeed",
      supportsImages: false,
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "dashscope" && process.env.DASHSCOPE_API_KEY) {
    return {
      name: "dashscope",
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseUrl: process.env.AI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: process.env.AI_MODEL || "qwen3-vl-plus",
      supportsImages: true,
      apiStyle: "openai"
    };
  }

  return null;
}

function isMiniMaxBaseUrl(value?: string) {
  return Boolean(value && /minimax/i.test(value));
}

function isVagueFoodDescription(description: string) {
  const text = description.replace(/\s+/g, "");
  if (!text) return false;
  if (text.length <= 12 && /^(我)?(今天|早上|中午|晚上)?(吃什么|吃啥|吃点啥|吃点什么|该吃什么)[？?。!！]*$/.test(text)) return true;
  if (text.length <= 40 && /^(what|what should|what can|what do|what could)\s*(i|we)?\s*(eat|have|order|snack|drink)[?!.]*$/i.test(text)) return true;

  return false;
}

function exceedsExplicitFoodItemLimit(description: string) {
  return countExplicitFoodItems(description) > maxRecognizedFoodItems;
}

function countExplicitFoodItems(description: string) {
  const splitText = description
    .replace(/[()（）\[\]【】]/g, " ")
    .replace(/(还有|另外|另加|再加|以及|加上|配上|配了|包含|包括|其中|分别|点了|吃了|喝了|一共|总共|和|跟|及)/g, "、")
    .replace(/[+＋&、，,;；/／|｜\n]+/g, "、");

  const items = splitText
    .split("、")
    .map(cleanExplicitFoodPart)
    .filter(isLikelyExplicitFoodPart)
    .map(normalizeSearchText);

  return new Set(items).size;
}

function cleanExplicitFoodPart(value: string) {
  return value
    .trim()
    .replace(/^(我|我们|本人|自己|今天|早上|上午|中午|下午|晚上|夜宵|早餐|午餐|晚餐|这顿|这一顿|本餐)/, "")
    .replace(/^(\d+|[一二两三四五六七八九十]+)\s*(个人|人|位|个|份|碗|杯|根|块|片|只|条|盘|盒|袋|瓶)?/, "")
    .replace(/^(i|we|my|our|today|this morning|this afternoon|this evening|for breakfast|for lunch|for dinner|for a snack|for a meal|ate|had|drank|ordered)\s+/i, "")
    .replace(/^(\d+|[a-zA-Z]+)\s*(pieces?|items?|servings?|cups?|bowls?|plates?|boxes?|bags?|bottles?|cans?)?\s*/i, "")
    .trim();
}

function isLikelyExplicitFoodPart(value: string) {
  const text = normalizeSearchText(value);
  if (text.length < 2) return false;
  if (/^(个人|人|位|聚餐|多人|一起|一起吃|分着吃|分食|吃饭|吃了一顿)$/.test(text)) return false;
  if (hasFoodBrandMatch(value)) return true;

  return /饭|米|面|粉|粥|饺|馄|包|馒|饼|糕|肉|鸡|鸭|鹅|牛|羊|猪|鱼|虾|蟹|贝|蛋|豆|菜|瓜|果|菇|笋|藕|奶|茶|咖啡|可乐|饮料|酒|汉堡|薯|披萨|寿司|沙拉|汤|串|丸|肠|棒|餐|火锅|烤|炸|煎|炒|蒸|拌|卤|烧|炖|煮/.test(text)
    || /chicken|beef|pork|lamb|fish|shrimp|salmon|tuna|egg|tofu|rice|noodle|pasta|bread|burger|pizza|sandwich|salad|soup|steak|fries|snack|fruit|apple|banana|orange|berry|vegetable|yogurt|milk|coffee|tea|protein|shake|wrap|taco|burrito|bowl|meal/i.test(text);
}

function buildTooManyFoodsResponse(language: Language = "zh") {
  return Response.json(
    {
      ok: false,
      message: localized(
        language,
        `一次最多识别 ${maxRecognizedFoodItems} 个食物，请分批输入。`,
        `You can recognize up to ${maxRecognizedFoodItems} foods at a time. Please split them into batches.`
      )
    },
    { status: 400 }
  );
}

function buildTooManyFoodsResponseIfNeeded(foods: unknown[], language: Language = "zh") {
  return foods.length > maxRecognizedFoodItems ? buildTooManyFoodsResponse(language) : null;
}

function isTooManyFoodDecision(decision: AiRouteDecision) {
  const text = `${decision.message ?? ""}${decision.reason ?? ""}`;
  return decision.route === "not_food" && /最多|超过|太多|过多|6|六|too many|more than|at most|max(imum)?/i.test(text);
}

async function classifyFoodRoute(
  provider: ProviderConfig,
  description: string,
  strictLocalMatches: StrictLocalFoodMatch[],
  language: Language
): Promise<{ ok: true; decision: AiRouteDecision } | { ok: false; response: Response | null; errorText: string }> {
  const prompt = [
    "你是食物识别路由和营养估算助手。只返回严格 JSON 对象，不要 Markdown。",
    outputLanguageInstruction(language),
    "三条核心路由：",
    "1. local_exact：服务端本地库候选完整覆盖用户输入且无额外食物；foods=[]。没有候选时禁止用。",
    "2. brand_search：用户明确写了品牌/门店 + 具体产品/菜品；foods=[]，后端走 Tavily。",
    "3. ai_estimate：其他具体食物/菜名/餐食；本次直接输出 foods。",
    "not_food：没有具体食物、在问饮食建议，或明确列出超过 6 个具体食物；foods=[]。",
    "你只是路由建议，服务端会复核本地库和品牌条件。",
    formatStrictLocalCandidatesForRouting(strictLocalMatches),
    getBrandCatalogPrompt(description),
    "只按用户写出的食物、配菜、主食、饮料和份量估算；不要自行添加未提到的项目。",
    getChinesePortionBaselinePrompt(),
    `route=ai_estimate 时最多输出 ${maxRecognizedFoodItems} 个 foods；如果用户列出超过 ${maxRecognizedFoodItems} 个具体食物，route=not_food，message=一次最多识别 6 个食物，请分批输入。`,
    "food 字段：name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
    "macros 字段：protein、carbs、fat、calories、fiber，单位 g/g/g/kcal/g，整数。",
    "warning 是最多 24 个中文字的营养行动建议；高油、高糖、低纤维或精制主食偏多时给出一个具体替换或搭配方法，无需提醒时可为空。",
    "自检 calories≈protein*4+carbs*4+fat*9，误差大时先修正。",
    `用户输入：${description || "无"}。`,
    "输出 JSON 字段：isFoodRelated、route、brand、product、reason、message、foods。"
  ].join("\n");

  const { response, errorText } = await requestChatCompletion(
    provider,
    buildChatCompletionBody(provider, 900, [
      {
        role: "system",
        content: "你只输出可以被 JSON.parse 解析的 JSON 对象。"
      },
      {
        role: "user",
        content: prompt
      }
    ]),
    routingAiTimeoutMs
  );

  if (!response?.ok) return { ok: false, response: response ?? null, errorText };

  const json = await response.json();
  return { ok: true, decision: parseAiRouteDecision(extractAssistantContent(json)) };
}

function parseAiRouteDecision(content: unknown): AiRouteDecision {
  const payload = parseAiPayload(content) as AiRouteDecision;
  return payload && typeof payload === "object" ? payload : {};
}

function normalizeRouteDecision(decision: AiRouteDecision, description: string): AiRouteDecision {
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

function buildFallbackRouteDecision(
  description: string,
  strictLocalMatches: StrictLocalFoodMatch[],
  hasFiles: boolean,
  language: Language
): AiRouteDecision {
  if (!description.trim() && !hasFiles) {
    return {
      isFoodRelated: false,
      route: "not_food",
      message: localized(language, "我没有测出这一餐，请输入具体食物、品牌、套餐、配菜、饮料或份量。", "I couldn't identify that meal. Please enter a specific food, brand, combo, side, drink, or portion.")
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

function formatStrictLocalCandidatesForRouting(matches: StrictLocalFoodMatch[]) {
  if (!matches.length) return "服务端本地库严格命中候选：无。";

  return [
    "服务端本地库严格命中候选：",
    ...matches.map((match, index) => {
      const name = `${match.food.brand ?? ""} ${match.food.name ?? match.label}`.trim();
      return `${index + 1}. ${name}；关键 token=${match.tokens.join("、")}`;
    })
  ].join("\n");
}

function shouldUseBrandSearch(decision: AiRouteDecision, description: string) {
  if (decision.route !== "brand_search") return false;
  if (hasFoodBrandMatch(description)) return true;

  const brand = normalizeSearchText(decision.brand ?? "");
  const product = normalizeSearchText(decision.product ?? "");
  return brand.length >= 2 && product.length >= 2 && normalizeSearchText(description).includes(brand);
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

type StrictLocalFoodMatch = {
  food: AiFood;
  tokens: string[];
  label: string;
};

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

function findStrictLocalFoodMatches(description: string): StrictLocalFoodMatch[] {
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

function hasMeaningfulResidualAfterLocal(description: string, matches: StrictLocalFoodMatch[]) {
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

function buildStrictLocalResponse(matches: StrictLocalFoodMatch[], partial = false, language: Language = "zh") {
  return {
    ok: true,
    provider: "local-food-library",
    isFoodRelated: true,
    message: partial
      ? localized(language, "AI 暂时没有稳定返回；我先把本地库严格命中的食物放进草稿箱，未命中的部分可以再补充识别。", "The AI didn't return a stable result, so I added the local library matches to your draft tray. You can recognize the rest again.")
      : localized(language, "本地库已经严格命中这些食物，已直接放进草稿箱；右侧还可以继续手动微调。", "These foods matched the local library and were added to your draft tray. You can fine-tune the values on the right."),
    foods: matches.map((match) => normalizeFood(match.food, "ai-text", language))
  };
}

function getStrictLocalMatchPrompt(matches: StrictLocalFoodMatch[]) {
  if (!matches.length) return "";

  const lines = matches.map((match) => {
    const macros = match.food.macros;
    return `- ${match.food.brand ?? "未标品牌"} ${match.food.name ?? match.label}，份量=${match.food.portionLabel ?? "本地库份量"}，P${macros?.protein ?? 0}/C${macros?.carbs ?? 0}/F${macros?.fat ?? 0}/K${macros?.calories ?? 0}/纤维${macros?.fiber ?? 0}`;
  });

  return [
    "本地库已严格命中以下食物，并会由服务端计入最终结果：",
    ...lines,
    "规则：不要重复输出这些已命中的食物；只估算用户输入中除这些项目以外的额外食物。如果没有额外食物，foods 返回空数组。"
  ].join("\n");
}

function mergeStrictLocalAndAiFoods(
  localMatches: StrictLocalFoodMatch[],
  aiFoods: AiFood[],
  description: string,
  source: "ai-vision" | "ai-text" = "ai-text",
  language: Language = "zh"
) {
  const localFoods = localMatches.map((match) => normalizeFood(match.food, "ai-text", language));
  const filteredAiFoods = filterAiFoodsCoveredByStrictLocal(aiFoods, localMatches)
    .map((food) => normalizeFood(applyBrandCatalogToAiFood(food, description), source, language));

  return [...localFoods, ...filteredAiFoods];
}

function filterAiFoodsCoveredByStrictLocal(foods: AiFood[], localMatches: StrictLocalFoodMatch[]) {
  if (!localMatches.length) return foods;

  return foods.filter((food) => {
    const foodText = normalizeSearchText(`${food.brand ?? ""}${food.name ?? ""}${food.foodType ?? ""}${food.portionLabel ?? ""}`);
    return !localMatches.some((match) => match.tokens.some((token) => token.length >= 2 && foodText.includes(token)));
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

function buildExactLocalResult(description: string, language: Language = "zh") {
  const matches = findStrictLocalFoodMatches(description);
  if (!matches.length) return null;
  return buildStrictLocalResponse(matches, true, language);
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
  return getStrictCatalogMatchTokens(item, text).length > 0;
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
    "份量原则：不套固定菜品案例或克重表；按用户描述、菜系/品类、烹调方式、售卖规格和行业平均估算真实中位值。",
    "用户给了克数、个数、规格、大小份、人数、分食或剩余比例时优先使用；未写明时按普通成年人一次正常摄入估算，不默认大份/小份/偏高。",
    "多人共享餐按当前用户的实际摄入份额计算；共享菜分摊，个人主食/饮料/小吃单独计算，人数不明时说明假设。",
    "注意生熟重、可食部分、干湿重和酱汁油脂；关键假设写进 portionLabel，warning 保持很短。"
  ].join("\n");
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
    const response = await fetchWithTimeout("https://api.tavily.com/search", {
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
    }, tavilySearchTimeoutMs);

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

async function extractAiPayloadFromSearch(provider: ProviderConfig, description: string, searchContext: string, language: Language): Promise<AiPayload> {
  const prompt = [
    "你是营养信息结构化助手。只返回严格 JSON 对象，不要 Markdown，不要解释。",
    outputLanguageInstruction(language),
    "任务：根据用户食物描述和搜索结果，提取或估算每个食物的营养素。",
    "优先使用搜索结果中的品牌、产品、菜单、营养成分信息；如果搜索结果没有精确数值，但能确认食物类型，可结合行业平均估算。",
    "如果搜索结果只找到品牌菜单或产品介绍，没有营养表，也要保留用户写出的品牌名，并结合中国餐饮份量基准估算。",
    "严格只按用户写出的食物和份量估算；不要补充用户没写的配菜、主食或饮料。",
    getBrandCatalogPrompt(description),
    getChinesePortionBaselinePrompt(),
    `最多输出 ${maxRecognizedFoodItems} 个 foods；如果用户列出超过 ${maxRecognizedFoodItems} 个具体食物，返回空 foods 并提醒分批输入。`,
    "多食物必须拆分。每个 food 必须有 name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
    "不能生成互相包含的重复套餐；同一份肉、主食或配菜只能算一次。",
    "macros 包含 protein/carbs/fat/calories/fiber，单位 g/g/g/kcal/g，四舍五入为整数。",
    "自检：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正。",
    "warning 是最多 24 个中文字的营养行动建议；高油、高糖、低纤维或精制主食偏多时给出一个具体替换或搭配方法，无需提醒时可为空。",
    "输出 JSON 字段：isFoodRelated、message、foods；food 字段同上。",
    `用户描述：${description}`,
    `搜索结果：\n${searchContext}`
  ].join("\n");

  try {
    const { response } = await requestChatCompletion(
      provider,
      buildChatCompletionBody(provider, 1300, [
        {
          role: "system",
          content: "你只输出可以被 JSON.parse 解析的 JSON 对象。"
        },
        {
          role: "user",
          content: prompt
        }
      ]),
      searchAiTimeoutMs
    );

    if (!response?.ok) return {};
    const json = await response.json();
    return parseAiPayload(extractAssistantContent(json));
  } catch {
    return {};
  }
}

async function repairAiPayload(provider: ProviderConfig, description: string, firstContent: unknown, fallback: AiPayload, language: Language) {
  const repairPrompt = [
    "你是食物营养 JSON 结构化器。只返回严格 JSON 对象，不要 Markdown，不要解释。",
    outputLanguageInstruction(language),
    "用户描述的是食物时，必须返回 isFoodRelated=true，并把不同食物拆成 foods 数组。",
    "如果用户写了疑似品牌或门店名，brand 必须填这个品牌/门店名，不要写未识别品牌。",
    "严格只按用户写出的食物和份量估算；不要补充用户没写的配菜、主食或饮料，也不要生成互相包含的重复套餐。",
    getBrandCatalogPrompt(description),
    getChinesePortionBaselinePrompt(),
    `最多输出 ${maxRecognizedFoodItems} 个 foods；如果用户列出超过 ${maxRecognizedFoodItems} 个具体食物，返回空 foods 并提醒分批输入。`,
    "每个 food 必须有 name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
    "macros 必须包含 protein/carbs/fat/calories/fiber，单位分别是 g/g/g/kcal/g，数值用合理估算。",
    "自检：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正。",
    "如果品牌或具体产品能从文本识别出来，recognitionMode 用 brand-product；否则用 industry-average。",
    "warning 是最多 24 个中文字的营养行动建议；高油、高糖、低纤维或精制主食偏多时给出一个具体替换或搭配方法，无需提醒时可为空。",
    "输出 JSON 字段：isFoodRelated、message、foods；food 字段同上。",
    `用户描述：${description}`,
    `第一轮模型输出：${stringifyForPrompt(firstContent)}`
  ].join("\n");

  try {
    const { response } = await requestChatCompletion(
      provider,
      buildChatCompletionBody(provider, 1100, [
        {
          role: "system",
          content: "你只输出可以被 JSON.parse 解析的 JSON 对象。"
        },
        {
          role: "user",
          content: repairPrompt
        }
      ]),
      repairAiTimeoutMs
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
  if (Array.isArray(data.content)) {
    return data.content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const item = part as { text?: unknown; content?: unknown };
        return typeof item.text === "string" ? item.text : typeof item.content === "string" ? item.content : "";
      })
      .filter(Boolean)
      .join("\n");
  }
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

function buildChatCompletionBody(provider: ProviderConfig, maxTokens: number, messages: ChatMessage[]) {
  if (provider.apiStyle === "anthropic") return buildAnthropicMessagesBody(provider, maxTokens, messages);

  const tokenLimit =
    provider.name === "minimax"
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens };

  return JSON.stringify({
    model: provider.model,
    temperature: provider.name === "minimax" ? 0.1 : 0,
    ...tokenLimit,
    ...(provider.name === "deepseek" ? { thinking: { type: "disabled" } } : {}),
    messages
  });
}

function buildAnthropicMessagesBody(provider: ProviderConfig, maxTokens: number, messages: ChatMessage[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => messageContentToText(message.content))
    .filter(Boolean)
    .join("\n\n");
  const anthropicMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: messageContentToText(message.content)
    }));

  return JSON.stringify({
    model: provider.model,
    max_tokens: maxTokens,
    temperature: 0.1,
    thinking: { type: "disabled" },
    system: system || undefined,
    messages: anthropicMessages.length ? anthropicMessages : [{ role: "user", content: "" }]
  });
}

function messageContentToText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const item = part as { text?: unknown; type?: unknown };
        return typeof item.text === "string" ? item.text : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

function buildAiServiceErrorResponse(response: Response | null, errorText = "", language: Language = "zh") {
  const status = response?.status ?? 502;
  const message = getUserFacingAiErrorMessage(status, errorText, language);
  return Response.json({ ok: false, message }, { status });
}

function getUserFacingAiErrorMessage(status: number, errorText: string, language: Language) {
  const text = errorText.toLowerCase();

  if (status === 401 || status === 403 || /api key|unauthorized|forbidden|incorrect|auth|token/.test(text)) {
    return localized(language, "AI 服务鉴权失败。请检查 DeepSeek / CC Switch / MiniMax Key、模型名和部署环境变量。", "AI authentication failed. Check the DeepSeek / CC Switch / MiniMax key, model name, and deployment environment variables.");
  }

  if (status === 429) {
    return localized(language, "AI 服务请求太频繁了，稍等一下再识别。", "The AI service received too many requests. Wait a moment and try again.");
  }

  if (status === 408 || /timeout|超过|connect_timeout|fetch failed/.test(text)) {
    return localized(language, "AI 服务连接超时。请确认服务端网络或本地代理已经生效。", "The AI service timed out. Check the server network or your local proxy.");
  }

  return localized(language, "AI 服务暂时没有识别成功，请稍后再试。", "The AI service couldn't recognize it right now. Please try again later.");
}

async function requestChatCompletion(provider: ProviderConfig, body: string, timeoutMs = mainAiTimeoutMs) {
  const maxAttempts = provider.name === "ccswitch" ? 2 : 1;
  let lastResponse: Response | null = null;
  let lastErrorText = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const endpoint of getChatCompletionUrls(provider.baseUrl, provider)) {
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: getCompletionHeaders(provider),
          body
        }, timeoutMs);

        if (response.ok) return { response, errorText: "" };

        lastResponse = response;
        lastErrorText = await response.text();

        if (!shouldRetryAiResponse(response, lastErrorText) || attempt === maxAttempts) {
          if (response.status !== 404 && response.status !== 405) {
            return { response, errorText: lastErrorText };
          }
        }
      } catch (error) {
        lastErrorText = error instanceof Error ? error.message : "AI 请求超时或网络异常。";
        if (attempt === maxAttempts) {
          return {
            response: lastResponse,
            errorText: lastErrorText
          };
        }
      }
    }
  }

  return { response: lastResponse, errorText: lastErrorText };
}

function shouldRetryAiResponse(response: Response, errorText: string) {
  if (response.status === 408 || response.status === 429 || response.status >= 500) return true;
  return /timeout|超时|请求超过|fetch failed|connect_timeout|temporarily|upstream/i.test(errorText);
}

function getCompletionHeaders(provider: ProviderConfig) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json"
  };

  if (provider.apiStyle === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
  }

  return headers;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`请求超过 ${Math.round(timeoutMs / 1000)} 秒未返回`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getChatCompletionUrls(baseUrl: string, provider?: ProviderConfig) {
  if (provider?.apiStyle === "anthropic") return getAnthropicMessageUrls(baseUrl);

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

function getAnthropicMessageUrls(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1/messages")) return [trimmed];
  if (trimmed.endsWith("/messages")) return [trimmed];

  const urls: string[] = [];

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      urls.push(`${trimmed}/v1/messages`);
    } else if (trimmed.endsWith("/v1")) {
      urls.push(`${trimmed}/messages`);
    } else {
      urls.push(`${trimmed}/v1/messages`);
      urls.push(`${trimmed}/messages`);
    }
  } catch {
    return [`${trimmed}/v1/messages`];
  }

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

function isChineseText(value?: string) {
  return Boolean(value && /[\u4e00-\u9fff]/.test(value));
}

function chineseOrDefault(value: string | undefined, fallback: string) {
  return value && isChineseText(value) ? value : fallback;
}

function normalizeFood(food: AiFood, source: "ai-vision" | "ai-text", language: Language = "zh"): FoodLogItem {
  const macros = normalizeMacros(food.macros);

  const baseName = food.name?.trim() || localized(language, "AI 识别食物", "AI recognized food");
  const baseBrand = food.brand?.trim() || localized(language, "未识别品牌", "Unknown brand");
  const baseFoodType = food.foodType?.trim() || localized(language, "食品", "Food");
  const basePortionLabel = food.portionLabel?.trim() || localized(language, "AI 估算份量", "AI estimated portion");
  const baseImageName = localized(language, "AI 识别", "AI recognition");
  const warning = food.warning?.trim() || "";

  const nameZh = chineseOrDefault(food.nameZh?.trim(), language === "zh" ? baseName : translateToZh(baseName));
  const nameEn = food.nameEn?.trim() || (language === "en" ? baseName : translateToEn(nameZh));
  const brandZh = chineseOrDefault(food.brandZh?.trim(), language === "zh" ? baseBrand : translateToZh(baseBrand));
  const brandEn = food.brandEn?.trim() || (language === "en" ? baseBrand : translateToEn(brandZh));
  const foodTypeZh = chineseOrDefault(food.foodTypeZh?.trim(), language === "zh" ? baseFoodType : translateToZh(baseFoodType));
  const foodTypeEn = food.foodTypeEn?.trim() || (language === "en" ? baseFoodType : translateToEn(foodTypeZh));
  const portionLabelZh = chineseOrDefault(food.portionLabelZh?.trim(), language === "zh" ? basePortionLabel : translateToZh(basePortionLabel));
  const portionLabelEn = food.portionLabelEn?.trim() || (language === "en" ? basePortionLabel : translateToEn(portionLabelZh));
  const warningZh = warning ? chineseOrDefault(food.warningZh?.trim(), language === "zh" ? warning : translateToZh(warning)) : "";
  const warningEn = food.warningEn?.trim() || (warning ? (language === "en" ? warning : translateToEn(warningZh)) : "");
  const imageNameZh = localized("zh", "AI 识别", "AI recognition");
  const imageNameEn = localized("en", "AI 识别", "AI recognition");

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
    recognitionMode: food.recognitionMode === "industry-average" ? "industry-average" : "brand-product",
    imageName: language === "en" ? imageNameEn : imageNameZh,
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
    imageNameZh,
    imageNameEn
  };
}

function normalizeMacros(macros?: Partial<MacroTotals>): MacroTotals {
  return normalizeMacroTotals(macros as Record<string, unknown> | null | undefined);
}
