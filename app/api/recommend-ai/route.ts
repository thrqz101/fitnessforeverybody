import type { DayState, MacroTotals, Recommendation, UserProfile } from "@/lib/types";
import { getFoodCatalogPromptSummary } from "@/lib/food-catalog";

export const runtime = "nodejs";

type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type RecommendPayload = {
  recommendations?: Partial<Recommendation>[];
  message?: string;
};

const categories: Recommendation["category"][] = ["meal", "topup", "protein", "snack"];
const MAX_AI_RECOMMENDATIONS = 30;

export async function POST(request: Request) {
  try {
    const provider = getProviderConfig();

    if (!provider) {
      return Response.json(
        { ok: false, message: "AI 推荐还没配置好，请先检查服务环境变量。" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const desiredCount = getDesiredCount(body?.desiredCount);
    const prompt = buildRecommendationPrompt(body);
    const { response, errorText } = await requestChatCompletion(
      provider,
      JSON.stringify({
        model: provider.model,
        temperature: 0,
        max_tokens: 3600,
        messages: [
          {
            role: "system",
            content: "你是中国市场的健身饮食推荐助手，只返回可被 JSON.parse 解析的严格 JSON 对象。同一输入保持稳定推荐逻辑。"
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    );

    if (!response?.ok) {
      return Response.json(
        { ok: false, message: `AI 推荐暂时失败：${response?.status ?? 502} ${errorText.slice(0, 160)}` },
        { status: response?.status ?? 502 }
      );
    }

    const json = await response.json();
    const parsed = parseRecommendPayload(extractAssistantContent(json));
    const recommendations = normalizeRecommendations(parsed.recommendations ?? [], Boolean(body?.shouldLightOnly), desiredCount);

    return Response.json({
      ok: true,
      provider: "ai",
      message: parsed.message || "AI 已补充推荐。",
      recommendations
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "AI 推荐遇到未知错误。" },
      { status: 500 }
    );
  }
}

function buildRecommendationPrompt(body: {
  profile?: UserProfile;
  day?: DayState;
  gaps?: MacroTotals;
  targets?: MacroTotals;
  totals?: MacroTotals;
  mainMealCount?: number;
  shouldLightOnly?: boolean;
  desiredCount?: number;
  existingOptions?: string[];
}) {
  const profile = body.profile;
  const day = body.day;
  const gaps = body.gaps;
  const targets = body.targets;
  const totals = body.totals;
  const catalogSummary = getFoodCatalogPromptSummary({
    goal: profile?.goal,
    lightOnly: body.shouldLightOnly,
    limit: body.shouldLightOnly ? 42 : 58
  });
  const desiredCount = getDesiredCount(body.desiredCount);

  return [
    `请基于用户今天的营养缺口，生成 ${desiredCount} 个中国用户容易买到/点到的饮食推荐。`,
    "必须覆盖更多品牌和品类，例如早餐店、包子馒头、胡辣汤、面条馄饨、火锅、烤肉、炒菜、快餐、便利店、奶茶咖啡、轻食、水果、零食、蛋白粉等。",
    body.shouldLightOnly
      ? "重要：用户今日整体营养平均达成已经超过 80%，本次只能推荐水果、零食、酸奶、蛋白粉、便利店轻加餐、轻饮品等；不要推荐火锅正餐、烧烤、大份米饭、夜宵正餐。"
      : "重要：用户今日整体营养平均达成还没到 80%，本次优先推荐正餐或第四顿饭；可以包含早餐、午饭、晚饭、火锅、烤肉、炒菜、粉面、快餐等。",
    "每个推荐要可执行，不要泛泛写“吃健康餐”。海底捞请写具体菜品和锅底/蘸料建议。",
    "不同推荐之间不能重复。火锅、麻辣烫、冒菜这类可以同品牌多推荐几种，但每一种必须是不同配菜组合。",
    "减肥/减重或减脂用户要少推奶茶、火锅、烧烤；如果推荐奶茶，要写少糖、少小料、不加奶盖等配置。",
    "输出严格 JSON，不要 Markdown。格式：",
    '{"message":"一句中文说明","recommendations":[{"id":"ai-rec-xxx","title":"推荐标题","brand":"品牌","category":"meal|topup|protein|snack","items":["具体食物1","具体食物2"],"macros":{"protein":20,"carbs":30,"fat":10,"calories":300,"fiber":5},"note":"为什么适合","caution":"可选提醒"}]}',
    `用户目标：${profile?.goal ?? "unknown"}，训练结构：${profile?.trainingStyle ?? "unknown"}，饮食结构：${profile?.eatingPattern ?? "unknown"}`,
    `今日训练：${day?.isTrainingDay ? "训练日" : "休息日"}，训练部位：${day?.trainingPart ?? "无"}，饮食状态：${day?.dietStatus ?? "normal"}`,
    `已记录正餐数：${body.mainMealCount ?? 0}`,
    `今日目标：${stringifyForPrompt(targets)}`,
    `今日已吃：${stringifyForPrompt(totals)}`,
    `今日缺口：${stringifyForPrompt(gaps)}`,
    "优先从下面的主流食物知识库里挑选、组合或小幅改写；如果知识库没有命中，再用同品类行业平均估算。知识库格式为：品牌｜标题｜类型｜品类｜食物项｜P蛋白/C碳水/F脂肪/K热量/纤维｜备注。",
    catalogSummary,
    `已有本地候选，尽量别重复：${(body.existingOptions ?? []).join("；")}`
  ].join("\n");
}

function getProviderConfig(): ProviderConfig | null {
  if (!process.env.MINIMAX_API_KEY) return null;
  return {
    apiKey: process.env.MINIMAX_API_KEY,
    baseUrl: process.env.AI_BASE_URL || process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1",
    model: process.env.AI_MODEL || "MiniMax-M2.7-highspeed"
  };
}

async function requestChatCompletion(provider: ProviderConfig, body: string) {
  let lastResponse: Response | null = null;
  let lastErrorText = "";

  for (const endpoint of getChatCompletionUrls(provider.baseUrl)) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body
    });

    if (response.ok) return { response, errorText: "" };

    lastResponse = response;
    lastErrorText = await response.text();

    if (response.status !== 404 && response.status !== 405) {
      return { response, errorText: lastErrorText };
    }
  }

  return { response: lastResponse, errorText: lastErrorText };
}

function getChatCompletionUrls(baseUrl: string) {
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

function extractAssistantContent(json: unknown): unknown {
  if (!json || typeof json !== "object") return undefined;
  const data = json as {
    choices?: Array<{
      text?: unknown;
      message?: {
        content?: unknown;
      };
    }>;
    output_text?: unknown;
    content?: unknown;
  };
  const choice = data.choices?.[0];
  return choice?.message?.content ?? choice?.text ?? data.output_text ?? data.content;
}

function parseRecommendPayload(content: unknown): RecommendPayload {
  if (content && typeof content === "object" && !Array.isArray(content)) return content as RecommendPayload;
  if (typeof content !== "string") return {};
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  try {
    return JSON.parse(cleaned) as RecommendPayload;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as RecommendPayload;
    } catch {
      return {};
    }
  }
}

function normalizeRecommendations(items: Partial<Recommendation>[], shouldLightOnly: boolean, desiredCount: number): Recommendation[] {
  const seen = new Set<string>();

  return items
    .map((item, index) => {
      const macros = normalizeMacros(item.macros);
      const category = categories.includes(item.category as Recommendation["category"])
        ? item.category as Recommendation["category"]
        : shouldLightOnly
          ? "topup"
          : "meal";

      return {
        id: item.id?.startsWith("ai-rec-") ? item.id : `ai-rec-${Date.now()}-${index}`,
        title: item.title?.trim() || "AI 推荐",
        brand: item.brand?.trim() || "AI 推荐",
        category,
        items: Array.isArray(item.items) && item.items.length ? item.items.slice(0, 8).map(String) : ["按描述估算组合"],
        macros,
        note: item.note?.trim() || "根据今日缺口生成的推荐，可以按实际份量微调。",
        caution: item.caution?.trim()
      };
    })
    .filter((item) => !shouldLightOnly || item.category !== "meal")
    .filter((item) => !shouldLightOnly || item.macros.calories <= 560)
    .filter((item) => {
      const key = `${item.brand.toLowerCase().replace(/\s+/g, "")}::${item.title.toLowerCase().replace(/\s+/g, "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, desiredCount);
}

function getDesiredCount(value: unknown) {
  const numberValue = Number(value ?? MAX_AI_RECOMMENDATIONS);
  if (!Number.isFinite(numberValue)) return MAX_AI_RECOMMENDATIONS;
  return Math.min(MAX_AI_RECOMMENDATIONS, Math.max(1, Math.round(numberValue)));
}

function normalizeMacros(macros?: Partial<MacroTotals>): MacroTotals {
  return {
    protein: safeNumber(macros?.protein),
    carbs: safeNumber(macros?.carbs),
    fat: safeNumber(macros?.fat),
    calories: safeNumber(macros?.calories),
    fiber: safeNumber(macros?.fiber)
  };
}

function safeNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : 0;
}

function stringifyForPrompt(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "unknown";
  }
}
