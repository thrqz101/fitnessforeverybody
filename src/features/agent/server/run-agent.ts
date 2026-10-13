import {
  buildChatCompletionBody,
  contentToString,
  getProviderConfig,
  requestChatCompletion,
  type AgentChatMessage
} from "@/features/agent/server/llm";
import { executeTool, getToolDefinitions, getToolDescriptions } from "@/features/agent/server/tools";
import { getDbMeta, type DbMeta } from "@/shared/catalog/nutrition-db";
import type { Language } from "@/shared/i18n/i18n-utils";

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
    "可用工具（function calling），由你依据用户描述自主选择，可多次调用：",
    ...getToolDescriptions(),
    "调用提示：",
    "- 单食物每100g营养 → query_local_food_db 最合适。",
    "- 品牌/门店/包装食品等本地库口径之外 → exa_web_search。",
    "- 罕见菜/自制菜/组合餐 → ask_llm_estimate。",
    "- 本地工具出现needsClarification时必须确认生熟状态或品种，不可自行选候选第一条。missingNutrients为缺失项，不把0当作确定为零。",
    "- 每次调用后回填结果，直到得出最终回答。source和dbMeta仅作内部诊断，用户回答不要写数据库、本地库、模型或LLM。只有联网检索成功且已提取可用食品结果时，才附实际取得的网页来源链接。不得编造链接。",
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
