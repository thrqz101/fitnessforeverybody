import type { Language } from "@/shared/i18n/i18n-utils";
import { localized } from "@/features/recognition/domain/prompts";

type ChatMessage = {
  role: "system" | "user";
  content: unknown;
};

export type ProviderConfig = {
  name: "ccswitch" | "deepseek" | "minimax" | "dashscope";
  apiKey: string;
  baseUrl: string;
  model: string;
  apiStyle: "anthropic" | "openai";
};

export const routingAiTimeoutMs = 20_000;

export const searchAiTimeoutMs = 25_000;

export const mainAiTimeoutMs = 35_000;

export const repairAiTimeoutMs = 20_000;

export const warmupAiTimeoutMs = 12_000;

export function getProviderConfig(): ProviderConfig | null {
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
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "ccswitch" && ccswitchApiKey) {
    return {
      name: "ccswitch",
      apiKey: ccswitchApiKey,
      baseUrl: process.env.CCSWITCH_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://v2.aicodee.com",
      model: process.env.CCSWITCH_MODEL || process.env.ANTHROPIC_MODEL || process.env.MINIMAX_MODEL || process.env.AI_MODEL || "MiniMax-M2.7-highspeed",
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "minimax" && minimaxApiKey) {
    return {
      name: "minimax",
      apiKey: minimaxApiKey,
      baseUrl: process.env.MINIMAX_BASE_URL || process.env.AI_BASE_URL || (isMiniMaxBaseUrl(openAiBaseUrl) ? openAiBaseUrl : undefined) || "https://api.minimax.io/v1",
      model: process.env.MINIMAX_MODEL || process.env.AI_MODEL || "MiniMax-M2.7-highspeed",
      apiStyle: "openai"
    };
  }

  if (requestedProvider === "dashscope" && process.env.DASHSCOPE_API_KEY) {
    return {
      name: "dashscope",
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseUrl: process.env.AI_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: process.env.AI_MODEL || "qwen3-vl-plus",
      apiStyle: "openai"
    };
  }

  return null;
}

function isMiniMaxBaseUrl(value?: string) {
  return Boolean(value && /minimax/i.test(value));
}

export function extractAssistantContent(json: unknown): unknown {
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

export function stringifyForPrompt(value: unknown) {
  if (typeof value === "string") return value.slice(0, 1800);
  try {
    return JSON.stringify(value).slice(0, 1800);
  } catch {
    return "";
  }
}

export function buildChatCompletionBody(provider: ProviderConfig, maxTokens: number, messages: ChatMessage[]) {
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

export function buildAiServiceErrorResponse(response: Response | null, errorText = "", language: Language = "zh") {
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

export async function requestChatCompletion(provider: ProviderConfig, body: string, timeoutMs = mainAiTimeoutMs, signal?: AbortSignal) {
  const maxAttempts = provider.name === "ccswitch" ? 2 : 1;
  let lastResponse: Response | null = null;
  let lastErrorText = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const endpoint of getChatCompletionUrls(provider.baseUrl, provider)) {
      signal?.throwIfAborted();
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: getCompletionHeaders(provider),
          body
        }, timeoutMs, signal);

        if (response.ok) return { response, errorText: "" };

        lastResponse = response;
        lastErrorText = await response.text();

        if (!shouldRetryAiResponse(response, lastErrorText) || attempt === maxAttempts) {
          if (response.status !== 404 && response.status !== 405) {
            return { response, errorText: lastErrorText };
          }
        }
      } catch (error) {
        signal?.throwIfAborted();
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

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal
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
