export type ProviderName = "ccswitch" | "deepseek" | "minimax" | "dashscope";
export type ApiStyle = "openai" | "anthropic";

export type AgentProvider = {
  name: ProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
  apiStyle: ApiStyle;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AgentChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type AgentTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type AssistantMessage = {
  content?: unknown;
  tool_calls?: ToolCall[];
};

export type ChatCompletionOptions = {
  tools?: AgentTool[];
  toolChoice?: "auto" | "none";
};

export type ChatResult =
  | { ok: true; json: unknown; message: AssistantMessage }
  | { ok: false; status: number; errorText: string };

const defaultAgentTimeoutMs = 30_000;

export function getProviderConfig(): AgentProvider | null {
  const requestedProvider = process.env.AI_PROVIDER?.toLowerCase() || "minimax";
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const ccswitchApiKey =
    process.env.CCSWITCH_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.MINIMAX_API_KEY ||
    process.env.MINIMAX_API_TOKEN;
  const minimaxApiKey =
    process.env.MINIMAX_API_KEY || process.env.MINIMAX_API_TOKEN || process.env.OPENAI_API_KEY;

  if (requestedProvider === "deepseek" && deepseekApiKey) {
    return {
      name: "deepseek",
      apiKey: deepseekApiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "ccswitch" && ccswitchApiKey) {
    return {
      name: "ccswitch",
      apiKey: ccswitchApiKey,
      baseUrl: process.env.CCSWITCH_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://v2.aicodee.com",
      model:
        process.env.CCSWITCH_MODEL ||
        process.env.ANTHROPIC_MODEL ||
        process.env.MINIMAX_MODEL ||
        process.env.AI_MODEL ||
        "MiniMax-M2.7-highspeed",
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "minimax" && minimaxApiKey) {
    return {
      name: "minimax",
      apiKey: minimaxApiKey,
      baseUrl: process.env.MINIMAX_BASE_URL || process.env.AI_BASE_URL || "https://api.minimax.io/v1",
      model: process.env.MINIMAX_MODEL || process.env.AI_MODEL || "MiniMax-M2.7-highspeed",
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "dashscope" && process.env.DASHSCOPE_API_KEY) {
    return {
      name: "dashscope",
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseUrl: process.env.AI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: process.env.AI_MODEL || "qwen-plus",
      apiStyle: "openai"
    };
  }

  return null;
}

export function contentToString(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in (c as Record<string, unknown>)) {
          return String((c as { text: unknown }).text);
        }
        return JSON.stringify(c);
      })
      .join("");
  }
  if (typeof content === "object") return JSON.stringify(content);
  return String(content);
}

export function buildChatCompletionBody(
  provider: AgentProvider,
  maxTokens: number,
  messages: AgentChatMessage[],
  options: ChatCompletionOptions = {}
): string {
  const { tools, toolChoice } = options;
  if (provider.apiStyle === "anthropic") {
    return JSON.stringify(buildAnthropicBody(provider, maxTokens, messages, tools, toolChoice));
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    max_tokens: maxTokens,
    stream: false
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice ?? "auto";
  }
  return JSON.stringify(body);
}

function buildAnthropicBody(
  provider: AgentProvider,
  maxTokens: number,
  messages: AgentChatMessage[],
  tools?: AgentTool[],
  toolChoice?: "auto" | "none"
): Record<string, unknown> {
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => contentToString(m.content))
    .join("\n");

  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "assistant" && m.tool_calls?.length) {
        return { role: "assistant", content: m.content ? contentToString(m.content) : "" };
      }
      if (m.role === "tool") {
        return {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: m.tool_call_id ?? "", content: contentToString(m.content) }]
        };
      }
      return { ...m, content: m.content };
    });

  const body: Record<string, unknown> = {
    model: provider.model,
    max_tokens: maxTokens,
    messages: rest
  };
  if (systemText) body.system = systemText;
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
    body.tool_choice = { type: toolChoice === "none" ? "auto" : "auto" };
  }
  return body;
}

export async function requestChatCompletion(
  provider: AgentProvider,
  body: string,
  timeoutMs: number = defaultAgentTimeoutMs
): Promise<ChatResult> {
  const endpoints = getChatCompletionUrls(provider.baseUrl, provider);
  let lastStatus = 0;
  let lastText = "";

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: buildHeaders(provider),
        body,
        signal: controller.signal
      });
      lastStatus = res.status;
      if (!res.ok) {
        lastText = await res.text().catch(() => "");
        continue;
      }
      const json: unknown = await res.json();
      const message = extractAssistantMessage(json);
      return { ok: true, json, message };
    } catch (error) {
      lastText = error instanceof Error ? error.message : String(error);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: lastStatus, errorText: lastText };
}

export function extractAssistantContent(json: unknown): unknown {
  const data = json as { choices?: Array<{ message?: AssistantMessage }> };
  const msg = data?.choices?.[0]?.message;
  if (msg) return msg.content;
  const anthropic = (json as { content?: Array<{ type: string; text?: unknown }> })?.content;
  if (Array.isArray(anthropic)) {
    return anthropic.filter((c) => c.type === "text").map((c) => c.text).join("");
  }
  return undefined;
}

function extractAssistantMessage(json: unknown): AssistantMessage {
  const data = json as { choices?: Array<{ message?: AssistantMessage }> };
  const msg = data?.choices?.[0]?.message;
  if (msg) return msg;

  const anthropic = (json as { content?: Array<{ type: string; text?: unknown; id?: string; name?: string; input?: unknown }> })?.content;
  if (Array.isArray(anthropic)) {
    const text = anthropic.filter((c) => c.type === "text").map((c) => String(c.text ?? "")).join("");
    const toolCalls: ToolCall[] = anthropic
      .filter((c) => c.type === "tool_use")
      .map((c) => ({
        id: c.id ?? "",
        type: "function" as const,
        function: { name: c.name ?? "", arguments: JSON.stringify(c.input ?? {}) }
      }));
    return { content: text || undefined, tool_calls: toolCalls.length ? toolCalls : undefined };
  }

  return {};
}

function buildHeaders(provider: AgentProvider): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`
  };
  if (provider.apiStyle === "anthropic") headers["anthropic-version"] = "2023-06-01";
  return headers;
}

function getChatCompletionUrls(baseUrl: string, provider?: AgentProvider): string[] {
  if (provider?.apiStyle === "anthropic") return getAnthropicMessageUrls(baseUrl);
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(trimmed)) return [trimmed];
  if (/\/v1$/.test(trimmed)) return [`${trimmed}/chat/completions`];
  return [`${trimmed}/chat/completions`, `${trimmed}/v1/chat/completions`];
}

function getAnthropicMessageUrls(baseUrl: string): string[] {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/\/messages$/.test(trimmed)) return [trimmed];
  if (/\/v1$/.test(trimmed)) return [`${trimmed}/messages`];
  return [`${trimmed}/messages`, `${trimmed}/v1/messages`];
}
