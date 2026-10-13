import type { Recommendation, UserProfile, DayState, MacroTotals } from "@/shared/domain/types";
import { type Language, pick, normalizeMacroTotals } from "@/shared/i18n/i18n-utils";
import { getFoodCatalogPromptSummary } from "@/shared/catalog/food-catalog";

type RecommendPayload = {
  recommendations?: Partial<Recommendation>[];
  message?: string;
};

function outputLanguageInstruction(language: Language) {
  return language === "en"
    ? "All user-facing text fields (message, title, brand, items, note, caution) must be written in English. Keep macro JSON keys as protein, carbs, fat, calories, fiber."
    : "所有面向用户的字段 message、title、brand、items、note、caution 必须使用中文；macros 的 JSON key 始终使用 protein、carbs、fat、calories、fiber。";
}

export function localized(language: Language, zh: string, en: string) {
  return pick(language, zh, en);
}

const categories: Recommendation["category"][] = ["meal", "topup", "protein", "snack"];
const MAX_AI_RECOMMENDATIONS = 30;

export function buildRecommendationPrompt(body: {
  profile?: UserProfile;
  day?: DayState;
  gaps?: MacroTotals;
  targets?: MacroTotals;
  totals?: MacroTotals;
  mainMealCount?: number;
  shouldLightOnly?: boolean;
  desiredCount?: number;
  existingOptions?: string[];
}, language: Language) {
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

  if (language === "en") {
    return [
      `Based on the user's remaining nutrition gap today, generate ${desiredCount} food recommendations that are easy to buy or order.`,
      outputLanguageInstruction(language),
      "All user-facing fields must be written in English, including message, title, brand, items, note, and caution. The catalog below may contain Chinese names; translate any reused item into natural English.",
      "Cover a wide range of brands and categories: breakfast, sandwiches, salads, fast food, convenience stores, coffee/tea, fruit, snacks, yogurt, protein powder, and light meals.",
      body.shouldLightOnly
        ? "Important: the user has already met over 80% of today's average nutrition target, so only recommend light top-ups such as fruit, snacks, yogurt, protein powder, convenience-store snacks, or light drinks. Do not recommend full hot-pot dinners, barbecue, large rice meals, or heavy late-night dinners."
        : "Important: the user has not yet reached 80% of today's average nutrition target, so prioritize a full meal or fourth meal. Breakfast, lunch, dinner, hot pot, barbecue, stir-fried dishes, noodles, and fast food are all allowed.",
      "Make each recommendation actionable. Do not write generic advice like \"eat a healthy meal\". For restaurant dishes, specify the concrete food or combination.",
      "Do not duplicate recommendations. Different recommendations must use different food combinations.",
      "For weight-loss or fat-loss users, avoid sugary drinks, hot pot, and barbecue unless clearly justified; if recommending a milk tea, specify less sugar, fewer toppings, and no cream cap.",
      "Return strict JSON only, with no Markdown. Format:",
      '{"message":"one English sentence","recommendations":[{"id":"ai-rec-xxx","title":"English title","brand":"Brand","category":"meal|topup|protein|snack","items":["specific food 1","specific food 2"],"macros":{"protein":20,"carbs":30,"fat":10,"calories":300,"fiber":5},"note":"why it fits","caution":"optional reminder"}]}',
      `User goal: ${profile?.goal ?? "unknown"}, training structure: ${profile?.trainingStyle ?? "unknown"}, eating pattern: ${profile?.eatingPattern ?? "unknown"}`,
      `Today's training: ${day?.isTrainingDay ? "training day" : "rest day"}, training body part: ${day?.trainingPart ?? "none"}, diet status: ${day?.dietStatus ?? "normal"}`,
      `Main meals logged: ${body.mainMealCount ?? 0}`,
      `Today's target: ${stringifyForPrompt(targets)}`,
      `Already eaten today: ${stringifyForPrompt(totals)}`,
      `Remaining gap today: ${stringifyForPrompt(gaps)}`,
      "Prefer selecting, combining, or lightly rewriting items from the food knowledge base below. If the knowledge base has no match, use a same-category industry average. Knowledge base format: brand | title | type | category | food items | protein P / carbs C / fat F / calories K / fiber | notes.",
      catalogSummary,
      `Existing local candidates to avoid if possible: ${(body.existingOptions ?? []).join("; ")}`
    ].join("\n");
  }

  return [
    `请基于用户今天的营养缺口，生成 ${desiredCount} 个中国用户容易买到/点到的饮食推荐。`,
    outputLanguageInstruction(language),
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

export function parseRecommendPayload(content: unknown): RecommendPayload {
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

export function normalizeRecommendations(items: Partial<Recommendation>[], shouldLightOnly: boolean, desiredCount: number, language: Language): Recommendation[] {
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
        title: item.title?.trim() || localized(language, "AI 推荐", "AI recommendation"),
        brand: item.brand?.trim() || localized(language, "AI 推荐", "AI recommendation"),
        category,
        items: Array.isArray(item.items) && item.items.length ? item.items.slice(0, 8).map(String) : [localized(language, "按描述估算组合", "Estimated from your description")],
        macros,
        note: item.note?.trim() || localized(language, "根据今日缺口生成的推荐，可以按实际份量微调。", "Generated from today's nutrient gaps. Adjust portions to match what you actually eat."),
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

export function getDesiredCount(value: unknown) {
  const numberValue = Number(value ?? MAX_AI_RECOMMENDATIONS);
  if (!Number.isFinite(numberValue)) return MAX_AI_RECOMMENDATIONS;
  return Math.min(MAX_AI_RECOMMENDATIONS, Math.max(1, Math.round(numberValue)));
}

function normalizeMacros(macros?: Partial<MacroTotals>): MacroTotals {
  return normalizeMacroTotals(macros as Record<string, unknown> | null | undefined);
}

function stringifyForPrompt(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "unknown";
  }
}
