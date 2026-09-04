import {
  buildChatCompletionBody,
  contentToString,
  extractAssistantContent,
  getProviderConfig,
  requestChatCompletion,
  type AgentChatMessage
} from "@/lib/agent/llm";

type AskLlmFallbackArgs = {
  description: string;
  portion?: string;
};

function buildFallbackPrompt(args: AskLlmFallbackArgs): string {
  return [
    "你是营养估算助手。本地食品库和联网搜索都没覆盖到该食物/餐食时，用提示工程给出近似估算。",
    "只输出可被 JSON.parse 解析的 JSON，不要 Markdown。",
    "输出字段：foods[].name、brand、foodType、portionLabel、macros{protein,carbs,fat,calories,fiber}（单位 g/g/g/kcal/g，取整）、recognitionMode、warning。",
    "按中国餐饮常见份量估算；calories 应大致约 protein*4+carbs*4+fat*9，误差大时先修正。",
    "warning 是最多 24 个中文字的简短营养行动建议，无需提醒时可为空。",
    `用户描述：${args.description || "无"}`,
    args.portion ? `份量说明：${args.portion}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export async function askLlmFallback(args: AskLlmFallbackArgs) {
  const provider = getProviderConfig();
  if (!provider) {
    return { ok: false, source: "llm_fallback", message: "AI 服务未配置，无法兜底估算。" };
  }

  const messages: AgentChatMessage[] = [
    { role: "system", content: "你只输出可以被 JSON.parse 解析的 JSON。" },
    { role: "user", content: buildFallbackPrompt(args) }
  ];
  const body = buildChatCompletionBody(provider, 1200, messages);
  const result = await requestChatCompletion(provider, body, 25_000);

  if (!result.ok) {
    return { ok: false, source: "llm_fallback", message: result.errorText || `LLM 请求失败 (${result.status})` };
  }

  const content = extractAssistantContent(result.json);
  const text = contentToString(content);
  let parsed: unknown = null;
  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }

  return { ok: true, source: "llm_fallback", text, parsed };
}
