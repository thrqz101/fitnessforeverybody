import type { AgentTool } from "@/features/agent/server/llm";
import { queryLocalFoodDb } from "@/features/agent/server/tools/food-nutrition";
import { exaWebSearch } from "@/features/agent/server/tools/web-search";
import { askLlmEstimate } from "@/features/agent/server/tools/llm-estimate";

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
      "查询可追溯的每100克可食部食品库（含参考家常配方），返回蛋白质/碳水/脂肪/热量/纤维；可选grams换算。必须明确生熟状态；歧义候选不得盲选，缺失项为0并有missingNutrients标记。",
    parameters: {
      type: "object",
      properties: {
        food: { type: "string", description: "明确食物和状态，如：熟鸡胸肉、米饭、番茄炒蛋、苹果" },
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
      "用 Exa 联网检索品牌/门店/包装食品等官方或公开营养信息，覆盖本地库口径之外的场景。",
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

export const llmEstimateTool: AgentTool = {
  type: "function",
  function: {
    name: "ask_llm_estimate",
    description:
      "对罕见菜、自制菜、组合餐等场景，用 LLM 估算某食物或一餐的宏量营养素，返回近似每份数值。",
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
  def: llmEstimateTool,
  execute: (a) => askLlmEstimate(a as { description: string; portion?: string }),
  source: "llm_estimate",
  label: "LLM 估算"
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
