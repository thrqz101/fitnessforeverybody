import type { AgentTool } from "@/lib/agent/llm";
import { queryLocalFoodDb } from "@/lib/tools/food-nutrition";
import { exaWebSearch } from "@/lib/tools/web-search";
import { askLlmFallback } from "@/lib/tools/llm-fallback";

type Executor = (args: Record<string, unknown>) => Promise<unknown>;

type RegisteredTool = {
  def: AgentTool;
  execute: Executor;
  source: string;
  label: string;
};

export const localFoodDbTool: AgentTool = {
  type: "function",
  function: {
    name: "query_local_food_db",
    description:
      "查询本地「每100克营养素」食品数据库，返回某食物每100g的蛋白质/碳水/脂肪/热量/纤维。优先用它获取可靠数值；可选 grams 换算成实际份量。",
    parameters: {
      type: "object",
      properties: {
        food: { type: "string", description: "食物名称，如：鸡胸肉、米饭、苹果" },
        grams: { type: "number", description: "实际食用克数（可选，默认100）" }
      },
      required: ["food"],
      additionalProperties: false
    }
  }
};

export const exaSearchTool: AgentTool = {
  type: "function",
  function: {
    name: "exa_web_search",
    description:
      "用 Exa 联网搜索最新/品牌/门店/包装食品营养信息。本地库没有、或用户提到具体品牌或门店时调用。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
        numResults: { type: "number", description: "返回条数（1-10，默认5）" }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
};

export const llmFallbackTool: AgentTool = {
  type: "function",
  function: {
    name: "ask_llm_fallback",
    description:
      "本地库与联网搜索都不足时，用提示工程 LLM 估算某食物/某餐的宏量营养素，返回近似每份数值。",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "食物或一餐的描述" },
        portion: { type: "string", description: "份量说明（可选）" }
      },
      required: ["description"],
      additionalProperties: false
    }
  }
};

const toolMap = new Map<string, RegisteredTool>();

function register(tool: RegisteredTool) {
  toolMap.set(tool.def.function.name, tool);
}

register({
  def: localFoodDbTool,
  execute: (a) => queryLocalFoodDb(a as { food: string; grams?: number }),
  source: "local_db",
  label: "本地食品库"
});
register({
  def: exaSearchTool,
  execute: (a) => exaWebSearch(a as { query: string; numResults?: number }),
  source: "exa_search",
  label: "Exa 联网搜索"
});
register({
  def: llmFallbackTool,
  execute: (a) => askLlmFallback(a as { description: string; portion?: string }),
  source: "llm_fallback",
  label: "LLM 兜底估算"
});

export function getToolDefinitions(): AgentTool[] {
  return Array.from(toolMap.values()).map((t) => t.def);
}

export function getToolDescriptions(): string[] {
  return Array.from(toolMap.values()).map((t) => `- ${t.def.function.name}: ${t.def.function.description}（source=${t.source}）`);
}

export async function executeTool(
  name: string,
  rawArgs: string
): Promise<{ result: unknown; source: string; label: string }> {
  const entry = toolMap.get(name);
  if (!entry) {
    return { result: { ok: false, source: "unknown_tool", message: `未知工具 ${name}` }, source: "unknown_tool", label: "未知工具" };
  }

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
  } catch {
    args = { raw: rawArgs };
  }

  const result = await entry.execute(args);
  return { result, source: entry.source, label: entry.label };
}
