import { hasFoodBrandMatch } from "@/features/recognition/domain/brand-catalog";
import type { Language } from "@/shared/i18n/i18n-utils";
import { maxRecognizedFoodItems, localized } from "@/features/recognition/domain/prompts";
import { normalizeSearchText } from "@/features/recognition/domain/local-match";
import type { AiRouteDecision } from "@/features/recognition/domain/types";

export function isVagueFoodDescription(description: string) {
  const text = description.replace(/\s+/g, "");
  if (!text) return false;
  if (text.length <= 12 && /^(我)?(今天|早上|中午|晚上)?(吃什么|吃啥|吃点啥|吃点什么|该吃什么)[？?。!！]*$/.test(text)) return true;
  if (text.length <= 40 && /^(what|what should|what can|what do|what could)\s*(i|we)?\s*(eat|have|order|snack|drink)[?!.]*$/i.test(text)) return true;

  return false;
}

export function exceedsExplicitFoodItemLimit(description: string) {
  return countExplicitFoodItems(description) > maxRecognizedFoodItems;
}

function countExplicitFoodItems(description: string) {
  const splitText = description
    .replace(/[()（）\[\]【】]/g, " ")
    .replace(/(还有|另外|另加|再加|以及|加上|配上|配了|包含|包括|其中|分别|点了|吃了|喝了|一共|总共|和|跟|及)/g, "、")
    .replace(/[+＋&、，,;；/／|｜\n]+/g, "、");

  const items = splitText
    .split("、")
    .map(cleanExplicitFoodPart)
    .filter(isLikelyExplicitFoodPart)
    .map(normalizeSearchText);

  return new Set(items).size;
}

function cleanExplicitFoodPart(value: string) {
  return value
    .trim()
    .replace(/^(我|我们|本人|自己|今天|早上|上午|中午|下午|晚上|夜宵|早餐|午餐|晚餐|这顿|这一顿|本餐)/, "")
    .replace(/^(\d+|[一二两三四五六七八九十]+)\s*(个人|人|位|个|份|碗|杯|根|块|片|只|条|盘|盒|袋|瓶)?/, "")
    .replace(/^(i|we|my|our|today|this morning|this afternoon|this evening|for breakfast|for lunch|for dinner|for a snack|for a meal|ate|had|drank|ordered)\s+/i, "")
    .replace(/^(\d+|[a-zA-Z]+)\s*(pieces?|items?|servings?|cups?|bowls?|plates?|boxes?|bags?|bottles?|cans?)?\s*/i, "")
    .trim();
}

function isLikelyExplicitFoodPart(value: string) {
  const text = normalizeSearchText(value);
  if (text.length < 2) return false;
  if (/^(个人|人|位|聚餐|多人|一起|一起吃|分着吃|分食|吃饭|吃了一顿)$/.test(text)) return false;
  if (hasFoodBrandMatch(value)) return true;

  return /饭|米|面|粉|粥|饺|馄|包|馒|饼|糕|肉|鸡|鸭|鹅|牛|羊|猪|鱼|虾|蟹|贝|蛋|豆|菜|瓜|果|菇|笋|藕|奶|茶|咖啡|可乐|饮料|酒|汉堡|薯|披萨|寿司|沙拉|汤|串|丸|肠|棒|餐|火锅|烤|炸|煎|炒|蒸|拌|卤|烧|炖|煮/.test(text)
    || /chicken|beef|pork|lamb|fish|shrimp|salmon|tuna|egg|tofu|rice|noodle|pasta|bread|burger|pizza|sandwich|salad|soup|steak|fries|snack|fruit|apple|banana|orange|berry|vegetable|yogurt|milk|coffee|tea|protein|shake|wrap|taco|burrito|bowl|meal/i.test(text);
}

export function buildTooManyFoodsResponse(language: Language = "zh") {
  return Response.json(
    {
      ok: false,
      message: localized(
        language,
        `一次最多识别 ${maxRecognizedFoodItems} 个食物，请分批输入。`,
        `You can recognize up to ${maxRecognizedFoodItems} foods at a time. Please split them into batches.`
      )
    },
    { status: 400 }
  );
}

export function buildTooManyFoodsResponseIfNeeded(foods: unknown[], language: Language = "zh") {
  return foods.length > maxRecognizedFoodItems ? buildTooManyFoodsResponse(language) : null;
}

export function isTooManyFoodDecision(decision: AiRouteDecision) {
  const text = `${decision.message ?? ""}${decision.reason ?? ""}`;
  return decision.route === "not_food" && /最多|超过|太多|过多|6|六|too many|more than|at most|max(imum)?/i.test(text);
}
