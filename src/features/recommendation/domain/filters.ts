import type { Recommendation } from "@/shared/domain/types";

export type RegionFilter = "all" | "chinese" | "western";

export type MealSlotFilter = "all" | "breakfast" | "lunch_dinner" | "midnight" | "topup";

export type StyleFilter =
  | "all"
  | "breakfast"
  | "stir_fry"
  | "hotpot"
  | "malatang"
  | "korean_bbq"
  | "japanese"
  | "skewer_bbq"
  | "steak"
  | "rice_noodle"
  | "fast_food"
  | "tea_coffee"
  | "convenience"
  | "light_meal"
  | "fruit_snack"
  | "supplement";

export const regionFilters: Array<{ value: RegionFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "chinese", label: "中餐" },
  { value: "western", label: "西餐" }
];

export const mealSlotFilters: Array<{ value: MealSlotFilter; label: string }> = [
  { value: "all", label: "全部餐别" },
  { value: "breakfast", label: "早餐" },
  { value: "lunch_dinner", label: "午餐 / 晚餐" },
  { value: "midnight", label: "夜宵" },
  { value: "topup", label: "轻补" }
];

export const styleFilters: Array<{ value: StyleFilter; label: string; regions: RegionFilter[] }> = [
  { value: "all", label: "全部品类", regions: ["all", "chinese", "western"] },
  { value: "breakfast", label: "早餐早点", regions: ["all", "chinese"] },
  { value: "stir_fry", label: "家常菜 / 炒菜", regions: ["all", "chinese"] },
  { value: "hotpot", label: "火锅", regions: ["all", "chinese"] },
  { value: "malatang", label: "麻辣烫 / 冒菜", regions: ["all", "chinese"] },
  { value: "korean_bbq", label: "韩式烤肉", regions: ["all", "chinese"] },
  { value: "japanese", label: "日料", regions: ["all", "chinese"] },
  { value: "skewer_bbq", label: "烧烤 / 烤串", regions: ["all", "chinese"] },
  { value: "steak", label: "牛排", regions: ["all", "western"] },
  { value: "rice_noodle", label: "粉面 / 快餐", regions: ["all", "chinese"] },
  { value: "fast_food", label: "汉堡 / 西式快餐", regions: ["all", "western"] },
  { value: "tea_coffee", label: "奶茶 / 咖啡", regions: ["all", "chinese", "western"] },
  { value: "convenience", label: "便利店", regions: ["all", "chinese", "western"] },
  { value: "light_meal", label: "轻食", regions: ["all", "chinese", "western"] },
  { value: "fruit_snack", label: "水果零食", regions: ["all", "chinese", "western"] },
  { value: "supplement", label: "健身补剂", regions: ["all", "chinese", "western"] }
];

export function isLightRecommendation(recommendation: Recommendation) {
  if (recommendation.category === "meal") return false;
  const text = `${recommendation.title} ${recommendation.brand} ${recommendation.items.join(" ")}`;
  if (/夜宵正餐|大碗|米饭 1 碗|火锅套餐|烧烤大餐/.test(text)) return false;
  return recommendation.macros.calories <= 560;
}

export function matchesRecommendationFilters(
  recommendation: Recommendation,
  regionFilter: RegionFilter,
  mealSlotFilter: MealSlotFilter,
  styleFilter: StyleFilter
) {
  return (
    matchesRegionFilter(recommendation, regionFilter) &&
    matchesMealSlotFilter(recommendation, mealSlotFilter) &&
    matchesStyleFilter(recommendation, styleFilter)
  );
}

function matchesRegionFilter(recommendation: Recommendation, filter: RegionFilter) {
  if (filter === "all") return true;
  const western = isWesternRecommendation(recommendation);
  const shared = isSupplementRecommendation(recommendation);
  return filter === "western" ? western || shared : !western || shared;
}

function matchesMealSlotFilter(recommendation: Recommendation, filter: MealSlotFilter) {
  if (filter === "all") return true;
  const text = getRecommendationText(recommendation);
  const isBreakfast = /早餐|早点|包子|馒头|胡辣汤|馄饨|云吞|煎饼|鸡蛋灌饼|小米粥|油条|肠粉|小笼包|热干面|豆浆/.test(text);
  const isTopUp = recommendation.category === "topup" || recommendation.category === "protein" || recommendation.category === "snack";

  if (filter === "breakfast") return isBreakfast;
  if (filter === "lunch_dinner") return recommendation.category === "meal" && !isBreakfast;
  if (filter === "midnight") return !isBreakfast && (recommendation.category === "meal" || isTopUp || /夜宵|晚上|晚间|酪蛋白|燕麦杯|牛肉粉/.test(text));
  if (filter === "topup") return isTopUp;
  return true;
}

export function matchesStyleFilter(recommendation: Recommendation, filter: StyleFilter) {
  if (filter === "all") return true;
  const text = getRecommendationText(recommendation);

  if (filter === "breakfast") return /早餐|早点|包子|馒头|胡辣汤|馄饨|云吞|煎饼|鸡蛋灌饼|小米粥|油条|肠粉|小笼包|热干面|豆浆/.test(text);
  if (filter === "stir_fry") return /家常菜|自己做饭|炒菜|小炒|川菜|湘菜|粤菜|赣菜|江西|江浙|本帮|云贵|贵州|东北|西北|宫保|麻婆|鱼香|清蒸鱼|白切鸡|龙井虾仁|汽锅鸡|酸汤鱼|番茄炒蛋|西红柿炒鸡蛋|西兰花|青椒肉丝|土豆丝|家常豆腐|肉末茄子|虾仁滑蛋|虾仁炒蛋|香菇滑鸡|清蒸鲈鱼|蒜蓉青菜|土豆炖牛肉|冬瓜排骨汤|木耳炒鸡蛋|白菜豆腐|番茄牛腩|西红柿牛腩|芹菜炒牛肉|胡萝卜鸡丁/.test(text);
  if (filter === "hotpot") return /火锅|海底捞|巴奴|呷哺|番茄锅|清汤锅|毛肚|虾滑|肥牛/.test(text);
  if (filter === "malatang") return /麻辣烫|冒菜|杨国福|张亮|宽粉|豆腐皮/.test(text);
  if (filter === "korean_bbq") return /韩式烤肉|烤肉店|瘦牛肉|生菜包|泡菜|五花肉/.test(text);
  if (filter === "japanese") return /日料|寿司|刺身|三文鱼|鳗鱼饭|照烧|荞麦面|味增汤|天妇罗|亲子丼/.test(text);
  if (filter === "skewer_bbq") return /烧烤|烤串|羊肉串|牛肉串|鸡翅|烤韭菜|烤蘑菇/.test(text);
  if (filter === "steak") return /牛排|西冷|肉眼|菲力|肋眼|沙朗|战斧|sirloin|ribeye|filet/.test(text);
  if (filter === "rice_noodle") return /粉面|面馆|拉面|牛肉面|汤面|拌面|热干面|螺蛳粉|米粉|河粉|馄饨|云吞|饺子|盖浇饭|盖饭|牛肉饭|鸡腿饭|猪脚饭|烧腊饭|黄焖鸡|沙县|兰州|快餐饭|卤味饭|饭团/.test(text);
  if (filter === "fast_food") return /快餐|汉堡|麦当劳|肯德基|汉堡王|塔斯汀|德克士|必胜客|赛百味|披萨|三明治|薯条|鸡块/.test(text);
  if (filter === "tea_coffee") return /奶茶|茶饮|咖啡|拿铁|瑞幸|星巴克|喜茶|奈雪|霸王茶姬|蜜雪冰城|古茗|茶百道|柠檬水|水果茶/.test(text);
  if (filter === "convenience") return /便利店|全家|罗森|711|关东煮|饭团|鸡胸肉肠|蔬菜杯|即食/.test(text);
  if (filter === "light_meal") return /轻食|沙拉|波奇|poke|寿司|三文鱼|酸奶|奶酪|燕麦/.test(text);
  if (filter === "fruit_snack") return /水果|香蕉|苹果|橙子|蓝莓|小番茄|黄瓜|红薯|坚果|牛肉干|猪肉脯|毛豆|零食/.test(text);
  if (filter === "supplement") return /蛋白粉|酪蛋白|蛋白棒|健身补剂|乳清/.test(text);
  return true;
}

function isWesternRecommendation(recommendation: Recommendation) {
  return /麦当劳|肯德基|汉堡王|德克士|必胜客|赛百味|星巴克|瑞幸|披萨|汉堡|三明治|沙拉|波奇|poke|拿铁|咖啡|牛排|西冷|肉眼|菲力|肋眼|沙朗|战斧|pizza|subway|steak|sirloin|ribeye|filet/.test(getRecommendationText(recommendation));
}

function isSupplementRecommendation(recommendation: Recommendation) {
  return /蛋白粉|酪蛋白|蛋白棒|健身补剂|乳清|whey/.test(getRecommendationText(recommendation));
}

export function inferSuggestedMeal(recommendation: Recommendation) {
  const text = getRecommendationText(recommendation);

  if (/早餐|包子|馒头|胡辣汤|馄饨|云吞|煎饼|鸡蛋灌饼|小米粥|油条|肠粉|小笼包|热干面|豆浆/.test(text)) {
    return "推荐早饭";
  }

  if (/夜宵|晚上|晚间|酪蛋白|燕麦杯|牛肉粉/.test(text)) {
    return "推荐夜宵";
  }

  if (recommendation.category === "meal") {
    return "推荐午饭 / 晚饭 / 夜宵";
  }

  if (recommendation.category === "snack" || recommendation.category === "topup" || recommendation.category === "protein") {
    return "推荐轻补 / 夜宵";
  }

  return "";
}

export function getRecommendationText(recommendation: Recommendation) {
  return `${recommendation.title} ${recommendation.brand} ${recommendation.items.join(" ")}`;
}
