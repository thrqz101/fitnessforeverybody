import { type Language, normalizeLanguage } from "@/shared/i18n/i18n-utils";
import { getProviderConfig, requestChatCompletion, buildChatCompletionBody, extractAssistantContent } from "@/features/recommendation/server/llm-client";
import { getDesiredCount, buildRecommendationPrompt, localized, parseRecommendPayload, normalizeRecommendations } from "@/features/recommendation/domain/ai-recommendations";
import { requireApiUser } from "@/shared/supabase/api-auth";
import { getSupabasePublicConfig } from "@/shared/supabase/config";

export const runtime = "nodejs";

/** Signed-in users only when the backend is configured, like recognition itself: every call spends LLM credit. */
export async function POST(request: Request) {
  if (getSupabasePublicConfig()) {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
  }
  let language: Language = "zh";

  try {
    const provider = getProviderConfig();

    if (!provider) {
      return Response.json(
        { ok: false, message: "AI 推荐还没配置好，请先检查服务环境变量。" },
        { status: 503 }
      );
    }

    const body = await request.json();
    language = normalizeLanguage(body?.lang);
    const desiredCount = getDesiredCount(body?.desiredCount);
    const prompt = buildRecommendationPrompt(body, language);
    const { response, errorText } = await requestChatCompletion(
      provider,
      buildChatCompletionBody(provider, 3600, [
        {
          role: "system",
          content: language === "en"
            ? "You are a fitness nutrition recommendation assistant for global users. Return only strict JSON that can be parsed by JSON.parse. Keep recommendation logic stable for the same input."
            : "你是中国市场的健身饮食推荐助手，只返回可被 JSON.parse 解析的严格 JSON 对象。同一输入保持稳定推荐逻辑。"
        },
        {
          role: "user",
          content: prompt
        }
      ])
    );

    if (!response?.ok) {
      return Response.json(
        { ok: false, message: localized(language, `AI 推荐暂时失败：${response?.status ?? 502} ${errorText.slice(0, 160)}`, `AI recommendations failed temporarily: ${response?.status ?? 502} ${errorText.slice(0, 160)}`) },
        { status: response?.status ?? 502 }
      );
    }

    const json = await response.json();
    const parsed = parseRecommendPayload(extractAssistantContent(json));
    const recommendations = normalizeRecommendations(parsed.recommendations ?? [], Boolean(body?.shouldLightOnly), desiredCount, language);

    return Response.json({
      ok: true,
      provider: "ai",
      message: parsed.message || localized(language, "AI 已补充推荐。", "AI added new recommendations."),
      recommendations
    });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : localized(language, "AI 推荐遇到未知错误。", "AI recommendations hit an unknown error.") },
      { status: 500 }
    );
  }
}
