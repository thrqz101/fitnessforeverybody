type ExaWebSearchArgs = {
  query: string;
  numResults?: number;
};

type ExaResult = {
  title?: string;
  url?: string;
  text?: string;
  publishedDate?: string;
};

export async function exaWebSearch(args: ExaWebSearchArgs) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      source: "exa_search",
      message: "未配置 EXA_API_KEY，无法联网搜索。请改用本地库或 LLM 估算。"
    };
  }

  const numResults = Math.min(Math.max(args.numResults ?? 5, 1), 10);
  const endpoint = "https://api.exa.ai/search";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: args.query,
        numResults,
        type: "neural",
        contents: { text: { maxCharacters: 1200 } }
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, source: "exa_search", message: `Exa 请求失败 (${res.status})`, detail: text.slice(0, 300) };
    }

    const json = (await res.json()) as { results?: ExaResult[] };
    const results = (json.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      text: (r.text ?? "").slice(0, 1200),
      publishedDate: r.publishedDate
    }));

    return { ok: true, source: "exa_search", count: results.length, results };
  } catch (error) {
    return { ok: false, source: "exa_search", message: error instanceof Error ? error.message : String(error) };
  }
}
