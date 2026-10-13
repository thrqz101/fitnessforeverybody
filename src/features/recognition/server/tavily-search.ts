import { type SearchReference, safeExternalUrl } from "@/shared/domain/search-evidence";
import { buildFoodBrandSearchQuery } from "@/features/recognition/domain/brand-catalog";
import type { SearchDiagnostics } from "@/features/recognition/domain/types";
import { fetchWithTimeout } from "@/features/recognition/server/llm-client";

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

type TavilySearchPayload = {
  results?: TavilySearchResult[];
  answer?: string;
  response_time?: number;
};

const tavilySearchTimeoutMs = 5_000;

export async function searchNutritionWithTavily(description: string, diagnostic: SearchDiagnostics, signal?: AbortSignal): Promise<{ context: string; sources: SearchReference[] } | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) { diagnostic.status = "missing_config"; return null; }

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
        search_depth: diagnostic.depth,
        chunks_per_source: 1,
        max_results: 3,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        country: "china"
      })
    }, tavilySearchTimeoutMs, signal);

    if (!response.ok) {
      diagnostic.status = `http_${response.status}`;
      if (response.status === 400 || response.status === 422) {
        const detail = await response.text();
        diagnostic.invalidParameter = ["search_depth", "country", "chunks_per_source", "max_results"].find(name => detail.includes(name)) ?? "unknown";
      }
      return null;
    }
    const payload = await response.json() as TavilySearchPayload;
    if (typeof payload.response_time === "number" && Number.isFinite(payload.response_time)) diagnostic.providerMs = Math.round(payload.response_time * 1000);
    const results = (payload.results ?? [])
      .filter((result) => result.title || result.content)
      .slice(0, 3);

    diagnostic.resultCount = results.length;
    diagnostic.status = results.length ? "ok" : "empty";
    if (!results.length) return null;

    const context = results
      .map((result, index) => {
        const source = result.url ? `来源：${result.url}` : "来源：未知";
        return `#${index + 1} ${result.title ?? "未命名结果"}\n${source}\n摘要：${(result.content ?? "").slice(0, 700)}`;
      })
      .join("\n\n");
    const sources = results.flatMap(result => {
      const url = safeExternalUrl(result.url);
      return url ? [{ title: result.title || new URL(url).hostname, url }] : [];
    });
    return { context, sources };
  } catch {
    diagnostic.status = "timeout_or_network_error";
    return null;
  }
}
