import type { FoodLogItem, Recommendation } from "@/shared/domain/types";
import { catalogRecommendations } from "@/shared/catalog/food-catalog";

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const recommendations: Recommendation[] = [
  ...catalogRecommendations,
  {
    id: "rec-yoshinoya",
    title: "牛肉饭大碗 + 鸡排 + 煎蛋",
    brand: "吉野家",
    category: "meal",
    items: ["牛肉饭大碗", "鸡排", "煎蛋"],
    macros: { protein: 55, carbs: 90, fat: 35, calories: 890, fiber: 5 },
    note: "正常吃饭方案，蛋白质和脂肪都比较扎实，适合训练日。"
  },
  {
    id: "rec-hotpot",
    title: "牛肉片 + 蔬菜拼盘 + 米饭",
    brand: "海底捞",
    category: "meal",
    items: ["牛肉片 200g", "蔬菜拼盘", "米饭 1 碗"],
    macros: { protein: 55, carbs: 70, fat: 30, calories: 780, fiber: 9 },
    note: "火锅也能正常补营养，少用油碟和芝麻酱会更稳。",
    caution: "油碟和芝麻酱会显著增加脂肪。"
  },
  {
    id: "rec-hdl-lean",
    title: "捞派肥牛 + 虾滑 + 生菜菌菇",
    brand: "海底捞",
    category: "meal",
    items: ["捞派肥牛 150g", "虾滑半份", "生菜", "金针菇", "番茄锅"],
    macros: { protein: 58, carbs: 28, fat: 36, calories: 670, fiber: 8 },
    note: "火锅里更偏高蛋白的吃法，用番茄锅或清水锅会比牛油锅更稳。",
    caution: "麻酱、油碟和酥肉会把脂肪拉高。"
  },
  {
    id: "rec-hdl-light",
    title: "毛肚 + 豆腐 + 蔬菜拼盘",
    brand: "海底捞",
    category: "topup",
    items: ["毛肚半份", "豆腐半份", "菠菜", "娃娃菜", "菌菇"],
    macros: { protein: 30, carbs: 22, fat: 12, calories: 330, fiber: 9 },
    note: "两顿正餐后还差一点蛋白和纤维时，可以这样轻轻补，不用再吃一顿大正餐。"
  },
  {
    id: "rec-hdl-carb",
    title: "番茄锅牛肉片 + 小份捞面",
    brand: "海底捞",
    category: "meal",
    items: ["牛肉片 150g", "捞面小份", "豆皮", "青菜"],
    macros: { protein: 48, carbs: 62, fat: 24, calories: 660, fiber: 7 },
    note: "训练日缺碳水又想吃火锅时，小份捞面比乱加油碟更可控。"
  },
  {
    id: "rec-kfc",
    title: "烤鸡腿堡 + 鸡翅 + 中薯",
    brand: "肯德基",
    category: "meal",
    items: ["烤鸡腿堡", "鸡翅", "中薯"],
    macros: { protein: 50, carbs: 60, fat: 40, calories: 820, fiber: 5 },
    note: "补蛋白很快，但脂肪也会上来，适合缺口较大时用。"
  },
  {
    id: "rec-kfc-light",
    title: "香辣鸡腿堡 + 玉米杯",
    brand: "肯德基",
    category: "topup",
    items: ["香辣鸡腿堡", "玉米杯", "无糖茶"],
    macros: { protein: 24, carbs: 52, fat: 18, calories: 470, fiber: 5 },
    note: "比再加薯条可控一点，适合还差一小段碳水和蛋白时。"
  },
  {
    id: "rec-mcd-light",
    title: "板烧鸡腿堡 + 苹果片",
    brand: "麦当劳",
    category: "topup",
    items: ["板烧鸡腿堡", "苹果片", "无糖茶"],
    macros: { protein: 28, carbs: 48, fat: 16, calories: 455, fiber: 5 },
    note: "想吃汉堡但不想热量炸掉时，用水果替代薯条更轻。"
  },
  {
    id: "rec-burgerking",
    title: "皇堡 Jr. + 烤鸡块",
    brand: "汉堡王",
    category: "meal",
    items: ["皇堡 Jr.", "烤鸡块 6 块", "无糖饮料"],
    macros: { protein: 42, carbs: 45, fat: 28, calories: 600, fiber: 4 },
    note: "比大号套餐更好控量，适合缺蛋白但不想吃太撑。"
  },
  {
    id: "rec-shaxian",
    title: "鸡腿饭 + 卤蛋 + 青菜",
    brand: "沙县小吃",
    category: "meal",
    items: ["鸡腿饭", "卤蛋", "青菜"],
    macros: { protein: 48, carbs: 55, fat: 32, calories: 700, fiber: 7 },
    note: "外卖里比较朴素的一档，碳水和蛋白质都好补。"
  },
  {
    id: "rec-subway",
    title: "金枪鱼 6 寸 + 蔬菜加量",
    brand: "赛百味",
    category: "topup",
    items: ["金枪鱼 6 寸", "生菜番茄加量", "不加甜酱"],
    macros: { protein: 28, carbs: 46, fat: 15, calories: 430, fiber: 7 },
    note: "轻一点的连锁方案，适合两顿饭后补碳水、蛋白和纤维。"
  },
  {
    id: "rec-heytea-light",
    title: "清爽茶饮 + 小蛋白加餐",
    brand: "喜茶 / 奈雪",
    category: "topup",
    items: ["无糖茶底", "少量仙草", "茶叶蛋或酸奶"],
    macros: { protein: 14, carbs: 24, fat: 6, calories: 210, fiber: 3 },
    note: "想喝饮品时，茶底、少糖、少小料，再配一点蛋白，比奶盖大杯更适合补缺口。"
  },
  {
    id: "rec-luckin-yogurt",
    title: "无糖拿铁 + 希腊酸奶",
    brand: "瑞幸 / 便利店",
    category: "topup",
    items: ["无糖拿铁", "希腊酸奶 1 杯"],
    macros: { protein: 22, carbs: 18, fat: 8, calories: 245, fiber: 0 },
    note: "下午差一点蛋白质时很顺手，不用再点一顿正餐。"
  },
  {
    id: "rec-711",
    title: "关东煮牛肉丸 + 蔬菜 + 饭团",
    brand: "711",
    category: "snack",
    items: ["牛肉丸 4 个", "蔬菜拼盘", "饭团"],
    macros: { protein: 35, carbs: 45, fat: 18, calories: 520, fiber: 8 },
    note: "轻一点的便利店方案，适合不想吃太撑的时候。"
  },
  {
    id: "rec-familymart",
    title: "全家鸡胸肉 + 饭团 + 蔬菜汁",
    brand: "全家便利店",
    category: "snack",
    items: ["即食鸡胸肉", "饭团", "无糖蔬菜汁"],
    macros: { protein: 36, carbs: 44, fat: 8, calories: 390, fiber: 5 },
    note: "便利店也能吃得像样，适合训练后但不想等外卖。"
  },
  {
    id: "rec-bbq",
    title: "烤牛肉串 + 烤蔬菜 + 米饭",
    brand: "烧烤",
    category: "meal",
    items: ["烤牛肉串 10 串", "烤蔬菜", "米饭 1 碗"],
    macros: { protein: 55, carbs: 54, fat: 28, calories: 720, fiber: 6 },
    note: "比只吃串更平衡，加一碗饭能把训练日碳水补起来。",
    caution: "盐可能偏高，明天可以清淡一点。"
  },
  {
    id: "rec-salad-powder",
    title: "鸡胸沙拉 + 蛋白粉 1 勺",
    brand: "蛋白粉补充",
    category: "protein",
    items: ["鸡胸肉沙拉", "蛋白粉 1 勺"],
    macros: { protein: 65, carbs: 15, fat: 12, calories: 430, fiber: 7 },
    note: "吃不下太多饭时优先保蛋白，碳水缺口可以晚点再补。"
  },
  {
    id: "rec-noodle-powder",
    title: "清汤牛肉面 + 蛋白粉 1 勺",
    brand: "蛋白粉补充",
    category: "protein",
    items: ["清汤牛肉面中碗", "蛋白粉 1 勺"],
    macros: { protein: 60, carbs: 50, fat: 15, calories: 575, fiber: 5 },
    note: "蛋白和碳水都补，适合训练后但不想吃太油。"
  },
  {
    id: "rec-snack-powder",
    title: "坚果 + 香蕉 + 蛋白粉 1 勺",
    brand: "蛋白粉补充",
    category: "protein",
    items: ["坚果 30g", "香蕉 1 根", "蛋白粉 1 勺"],
    macros: { protein: 45, carbs: 40, fat: 25, calories: 560, fiber: 6 },
    note: "零食型补充方案，适合晚间不想再点大餐。"
  },
  {
    id: "rec-egg-yogurt",
    title: "茶叶蛋 + 希腊酸奶",
    brand: "便利店加餐",
    category: "topup",
    items: ["茶叶蛋 1 个", "无糖希腊酸奶 1 杯"],
    macros: { protein: 19, carbs: 10, fat: 8, calories: 190, fiber: 0 },
    note: "只差一点蛋白质时很适合，不用硬塞一顿正餐。"
  },
  {
    id: "rec-banana",
    title: "香蕉 2 根",
    brand: "水果加餐",
    category: "topup",
    items: ["香蕉 2 根"],
    macros: { protein: 3, carbs: 54, fat: 1, calories: 230, fiber: 6 },
    note: "差碳水或膳食纤维时轻轻补一下，训练日前后都方便。"
  },
  {
    id: "rec-fruit-fiber",
    title: "香蕉 + 蓝莓酸奶",
    brand: "水果加餐",
    category: "topup",
    items: ["香蕉 1 根", "蓝莓一小盒", "无糖酸奶 1 杯"],
    macros: { protein: 13, carbs: 44, fat: 4, calories: 260, fiber: 7 },
    note: "如果今天纤维和碳水差一点，用水果和酸奶补比夜宵正餐舒服。"
  },
  {
    id: "rec-orange-eggs",
    title: "橙子 + 茶叶蛋",
    brand: "水果加餐",
    category: "topup",
    items: ["橙子 2 个", "茶叶蛋 1 个"],
    macros: { protein: 10, carbs: 32, fat: 6, calories: 220, fiber: 6 },
    note: "差一点纤维和蛋白质时很轻，晚饭后也不会太顶。"
  },
  {
    id: "rec-beef-jerky-banana",
    title: "牛肉干 + 香蕉",
    brand: "零食加餐",
    category: "topup",
    items: ["低糖牛肉干 35g", "香蕉 1 根"],
    macros: { protein: 18, carbs: 31, fat: 4, calories: 235, fiber: 3 },
    note: "蛋白和碳水都差一点时，用零食就能补，不需要大夜宵。"
  },
  {
    id: "rec-apple-nuts",
    title: "苹果 + 坚果小包",
    brand: "零食加餐",
    category: "topup",
    items: ["苹果 1 个", "坚果 25g"],
    macros: { protein: 6, carbs: 30, fat: 15, calories: 270, fiber: 7 },
    note: "差一点热量、脂肪和纤维时很顺手，适合下午或夜里加餐。"
  },
  {
    id: "rec-pork-jerky",
    title: "猪肉脯小包 + 无糖茶",
    brand: "零食加餐",
    category: "topup",
    items: ["猪肉脯 35g", "无糖茶"],
    macros: { protein: 13, carbs: 12, fat: 4, calories: 140, fiber: 0 },
    note: "只差 10g 左右蛋白质时，用小零食补就够了。",
    caution: "钠可能偏高，别把它当每天固定方案。"
  },
  {
    id: "rec-protein-scoop",
    title: "蛋白粉 1 勺",
    brand: "健身补剂",
    category: "topup",
    items: ["蛋白粉 1 勺", "水或无糖豆浆"],
    macros: { protein: 26, carbs: 4, fat: 2, calories: 140, fiber: 0 },
    note: "蛋白质差一点时最省事，尤其适合吃不下正餐的人。"
  },
  {
    id: "rec-casein",
    title: "酪蛋白半勺 + 牛奶",
    brand: "健身补剂",
    category: "topup",
    items: ["酪蛋白半勺", "低脂牛奶 250ml"],
    macros: { protein: 24, carbs: 14, fat: 5, calories: 200, fiber: 0 },
    note: "晚上只差一点蛋白质时，不用再点夜宵正餐。"
  },
  {
    id: "rec-oat-night",
    title: "燕麦杯 + 牛奶",
    brand: "夜宵加餐",
    category: "snack",
    items: ["燕麦 40g", "牛奶 250ml"],
    macros: { protein: 15, carbs: 42, fat: 9, calories: 310, fiber: 5 },
    note: "夜里还饿但不想点外卖时，这个能补碳水、蛋白质和纤维。"
  },
  {
    id: "rec-night-meal",
    title: "牛肉粉 + 卤蛋 + 青菜",
    brand: "夜宵正餐",
    category: "meal",
    items: ["牛肉粉", "卤蛋", "青菜"],
    macros: { protein: 42, carbs: 76, fat: 18, calories: 650, fiber: 6 },
    note: "缺口还很大时，夜宵就别只吃小零食了，当第四顿饭补回来。"
  },
  {
    id: "rec-veggie-cup",
    title: "蔬菜杯 + 鸡胸肉肠",
    brand: "便利店加餐",
    category: "topup",
    items: ["蔬菜杯", "鸡胸肉肠 1 根"],
    macros: { protein: 16, carbs: 14, fat: 5, calories: 165, fiber: 6 },
    note: "纤维差一点、蛋白质也差一点时很合适。"
  },
  {
    id: "rec-milk-tea-light",
    title: "清爽奶茶小杯",
    brand: "奶茶加餐",
    category: "topup",
    items: ["小杯茶底", "三分糖或无糖", "少珍珠", "不加奶盖"],
    macros: { protein: 4, carbs: 32, fat: 6, calories: 205, fiber: 1 },
    note: "想喝奶茶也可以，但更推荐小杯、少糖、不要奶盖；小料选少珍珠或仙草就好。",
    caution: "减肥/减重或减脂时不要把奶茶当日常补碳水方案，偶尔快乐一下更稳。"
  },
  {
    id: "rec-mixue-light",
    title: "柠檬水 + 茶叶蛋",
    brand: "蜜雪冰城 / 便利店",
    category: "topup",
    items: ["少糖柠檬水", "茶叶蛋 1 个"],
    macros: { protein: 8, carbs: 26, fat: 5, calories: 180, fiber: 1 },
    note: "想喝点甜的可以这样配，热量轻一点，也能顺手补一点蛋白。"
  },
  {
    id: "rec-sushi-light",
    title: "三文鱼寿司 + 味增汤",
    brand: "日料轻食",
    category: "topup",
    items: ["三文鱼寿司 4 贯", "味增汤", "海藻小菜"],
    macros: { protein: 22, carbs: 40, fat: 10, calories: 340, fiber: 3 },
    note: "两顿正餐后还想吃点像样的，这种比大份盖饭更轻。"
  },
  {
    id: "rec-poke",
    title: "小份波奇碗",
    brand: "轻食行业平均",
    category: "topup",
    items: ["金枪鱼或鸡胸", "半份糙米", "牛油果少量", "蔬菜加量"],
    macros: { protein: 32, carbs: 42, fat: 16, calories: 450, fiber: 8 },
    note: "补蛋白、纤维和一点碳水，适合不想吃油腻正餐的时候。"
  }
];

export function recommendationToFood(recommendation: Recommendation): FoodLogItem {
  return {
    id: id("rec-food"),
    name: recommendation.title,
    brand: recommendation.brand,
    foodType: recommendation.category === "meal" ? "正餐组合" : recommendation.category === "protein" ? "健身补剂" : "加餐组合",
    portionLabel: "推荐份量",
    portionScale: 1,
    baseMacros: recommendation.macros,
    macros: recommendation.macros,
    meal: recommendation.category === "meal" ? "dinner" : "snack",
    warning: recommendation.caution,
    source: "recommendation",
    recognitionMode: "brand-product",
    loggedAt: now()
  };
}
