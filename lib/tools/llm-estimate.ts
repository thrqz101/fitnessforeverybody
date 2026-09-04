import {
  buildChatCompletionBody,
  contentToString,
  extractAssistantContent,
  getProviderConfig,
  requestChatCompletion,
  type AgentChatMessage
} from "@/lib/agent/llm";

type AskLlmEstimateArgs = {
  description: string;
  portion?: string;
};

function buildEstimatePrompt(args: AskLlmEstimateArgs): string {
  return [
    "你是营养估算助手。对罕见菜、自制菜、组合餐等本地库与联网难以精确覆盖的场景，给出符合中国餐饮习惯的近似估算。",
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

export async function askLlmEstimate(args: AskLlmEstimateArgs) {
  const provider = getProviderConfig();
  if (!provider) {
    return { ok: false, source: "llm_estimate", message: "AI 服务未配置，无法估算。" };
  }

  const messages: AgentChatMessage[] = [
    { role: "system", content: "你只输出可以被 JSON.parse 解析的 JSON。" },
    { role: "user", content: buildEstimatePrompt(args) }
  ];
  const body = buildChatCompletionBody(provider, 1200, messages);
  const result = await requestChatCompletion(provider, body, 25_000);

  if (!result.ok) {
    return { ok: false, source: "llm_estimate", message: result.errorText || `LLM 请求失败 (${result.status})` };
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

  return { ok: true, source: "llm_estimate", text, parsed };
}
