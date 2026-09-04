import {
  buildChatCompletionBody,
  contentToString,
  getProviderConfig,
  requestChatCompletion,
  type AgentChatMessage
} from "@/lib/agent/llm";
import { executeTool, getToolDefinitions, getToolDescriptions } from "@/lib/agent/tools";
import { getDbMeta, type DbMeta } from "@/lib/nutrition-db";
import type { Language } from "@/lib/i18n-utils";

const agentMaxTurns = 5;
const agentTimeoutMs = 30_000;

export type AgentOutcome = {
  ok: boolean;
  answer?: string;
  provenance: string[];
  dbMeta: DbMeta;
  needsConfig?: boolean;
  error?: string;
};

function buildSystemPrompt(language: Language): string {
  const dbMeta = getDbMeta();
  return [
    "你是营养估算 agent，负责判断该用哪个工具回答用户。",
    "可用工具（function calling），按优先级自主决定：",
    ...getToolDescriptions(),
    "调用规则：",
    "1. 用户问某食物/某菜每100g营养时，先调用 query_local_food_db。",
    "2. 本地库无结果，或用户提到具体品牌/门店/包装食品，调用 exa_web_search。",
    "3. 仍不足（罕见菜、自制菜、组合餐），调用 ask_llm_fallback 估算。",
    "4. 每次调用后把工具返回结果用于最终回答，并明确说明数据来源。",
    "5. 最终给出结论，并在回答中注明用过的工具 source（local_db / exa_search / llm_fallback）。",
    `本地食品库：version=${dbMeta.version}，条目=${dbMeta.count}，单位=${dbMeta.unit}。`,
    language === "en" ? "Answer in English, concise." : "用中文回答，简洁。"
  ].join("\n");
}

export async function runAgent(userQuery: string, language: Language): Promise<AgentOutcome> {
  const dbMeta = getDbMeta();
  const provider = getProviderConfig();
  if (!provider) {
    return { ok: false, provenance: [], dbMeta, needsConfig: true, error: "AI 服务未配置。" };
  }

  const tools = getToolDefinitions();
  const messages: AgentChatMessage[] = [
    { role: "system", content: buildSystemPrompt(language) },
    { role: "user", content: userQuery }
  ];
  const provenance: string[] = [];

  for (let turn = 0; turn < agentMaxTurns; turn++) {
    const body = buildChatCompletionBody(provider, 1600, messages, { tools });
    const result = await requestChatCompletion(provider, body, agentTimeoutMs);
    if (!result.ok) {
      return { ok: false, provenance, dbMeta, error: result.errorText || `LLM 请求失败 (${result.status})` };
    }

    const assistant = result.message;
    const toolCalls = assistant.tool_calls ?? [];
    if (toolCalls.length > 0) {
      messages.push({ role: "assistant", content: assistant.content ?? null, tool_calls: toolCalls });
      for (const call of toolCalls) {
        const executed = await executeTool(call.function.name, call.function.arguments);
        if (!provenance.includes(executed.source)) provenance.push(executed.source);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(executed.result)
        });
      }
      continue;
    }

    return { ok: true, answer: contentToString(assistant.content), provenance, dbMeta };
  }

  return { ok: false, provenance, dbMeta, error: `超过 ${agentMaxTurns} 轮仍未收敛。` };
}
