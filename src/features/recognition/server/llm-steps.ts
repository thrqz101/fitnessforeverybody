import type { Language } from "@/shared/i18n/i18n-utils";
import { getBrandCatalogPrompt } from "@/features/recognition/domain/brand-catalog";
import { type ProviderConfig, requestChatCompletion, buildChatCompletionBody, routingAiTimeoutMs, extractAssistantContent, searchAiTimeoutMs, stringifyForPrompt, repairAiTimeoutMs } from "@/features/recognition/server/llm-client";
import type { StrictLocalFoodMatch, AiRouteDecision, AiPayload } from "@/features/recognition/domain/types";
import { outputLanguageInstruction, getChinesePortionBaselinePrompt, maxRecognizedFoodItems } from "@/features/recognition/domain/prompts";
import { formatStrictLocalCandidatesForRouting, parseAiRouteDecision } from "@/features/recognition/domain/route-decision";
import { parseAiPayload } from "@/features/recognition/domain/ai-foods";

export async function classifyFoodRoute(
  provider: ProviderConfig,
  description: string,
  strictLocalMatches: StrictLocalFoodMatch[],
  language: Language,
  signal?: AbortSignal
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
    "校验 calories≈protein*4+carbs*4+fat*9，误差大时先修正。",
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
    routingAiTimeoutMs, signal
  );

  if (!response?.ok) return { ok: false, response: response ?? null, errorText };

  const json = await response.json();
  return { ok: true, decision: parseAiRouteDecision(extractAssistantContent(json)) };
}

export async function extractAiPayloadFromSearch(provider: ProviderConfig, description: string, searchContext: string, language: Language, signal?: AbortSignal): Promise<AiPayload> {
  const prompt = [
    "你是营养信息结构化助手。只返回严格 JSON 对象，不要 Markdown，不要解释。",
    outputLanguageInstruction(language),
    "任务：根据用户食物描述和搜索结果，提取或估算每个食物的营养素。",
    "只有使用匹配产品、地区及份量的公开营养数值时，recognitionMode=brand-product。没有匹配数值时可按行业平均估算，但 recognitionMode=industry-average，message 必须说明估算，不能声称查到该产品营养表。",
    "如果只找到菜单或产品介绍，保留用户品牌，按常见份量估算并明确标注。份量、地区或产品不一致不能当作精确数值。",
    "严格只按用户写出的食物和份量估算；不要补充用户没写的配菜、主食或饮料。",
    getBrandCatalogPrompt(description),
    getChinesePortionBaselinePrompt(),
    `最多输出 ${maxRecognizedFoodItems} 个 foods；如果用户列出超过 ${maxRecognizedFoodItems} 个具体食物，返回空 foods 并提醒分批输入。`,
    "多食物必须拆分。每个 food 必须有 name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
    "不能生成互相包含的重复套餐；同一份肉、主食或配菜只能算一次。",
    "macros 包含 protein/carbs/fat/calories/fiber，单位 g/g/g/kcal/g，四舍五入为整数。",
    "校验：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正。",
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
      searchAiTimeoutMs, signal
    );

    if (!response?.ok) return {};
    const json = await response.json();
    return parseAiPayload(extractAssistantContent(json));
  } catch {
    return {};
  }
}

export async function repairAiPayload(provider: ProviderConfig, description: string, firstContent: unknown, fallback: AiPayload, language: Language, signal?: AbortSignal) {
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
    "校验：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正。",
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
      repairAiTimeoutMs, signal
    );

    if (!response?.ok) return fallback;
    const json = await response.json();
    const repaired = parseAiPayload(extractAssistantContent(json));
    return repaired.isFoodRelated || repaired.foods?.length ? repaired : fallback;
  } catch {
    return fallback;
  }
}
