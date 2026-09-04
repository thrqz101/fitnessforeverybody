import generatedTranslations from "@/lib/translations-generated.json";
import type { Language } from "@/lib/i18n-utils";
import type { FoodLogItem } from "@/lib/types";

const generatedZhToEn = generatedTranslations as Record<string, string>;

export const zhToEn: Record<string, string> = {
  "今天": "Today",
  "进度": "Progress",
  "灵感": "Ideas",
  "设置": "Settings",
  "识别与记录": "Log & recognize",
  "趋势与日历": "Trends & calendar",
  "聪明吃什么": "Eat smarter",
  "调整目标": "Adjust goals",
  "主要导航": "Main navigation",
  "打开设置": "Open settings",
  "今日节奏": "Today's rhythm",
  "还可摄入 {count} kcal": "{count} kcal remaining",
  "训练日": "Training day",
  "恢复日": "Rest day",
  "你的健康计划": "Your health plan",
  "正在准备你的健康空间": "Preparing your health space",
  "今天距离营养达标还差一点噢": "You're almost at today's nutrition target",
  "要不要加个餐补一补？我可以推荐水果、零食、健身补剂或者夜宵，就看你有多饿了～": "Want a small top-up? I can suggest fruit, snacks, supplements, or a late-night bite.",
  "看加餐推荐": "See top-up ideas",
  "再识别一餐": "Log another meal",
  "今天先这样": "That's all for today",
  "未命名食物": "Unnamed food",
  "食品": "Food",
  "未识别品牌": "Unknown brand",
  "AI 识别": "AI recognition",
  "AI 识别食物": "AI recognized food",
  "AI 估算份量": "AI estimated portion",
  "记录今天的饮食": "Log today's meals",
  "用一句话描述你今天吃了什么，AI 会拆成多个食品条目，逐项估算营养素，并按份量汇总。": "Describe what you ate in one sentence; the AI splits it into food items, estimates each, and sums by portion.",
  "写清楚品牌、套餐、主食、配菜、饮料和大概份量，估算会更准。": "Include the brand, meal, staples, sides, drinks, and approximate portions for a more accurate estimate.",
  "主食": "Main dish",
  "标准份": "Standard portion",
  "训练": "Training",
  "休息": "Rest",
  "练": "Train",
  "吃": "Eat",
  "恢复": "Recovery",
  "日": "Sun",
  "一": "Mon",
  "二": "Tue",
  "三": "Wed",
  "四": "Thu",
  "五": "Fri",
  "六": "Sat",
  "蛋白质": "Protein",
  "蛋白": "Protein",
  "碳水": "Carbs",
  "脂肪": "Fat",
  "热量": "Calories",
  "膳食纤维": "Fiber",
  "纤维": "Fiber",
  "增肌": "Muscle gain",
  "减脂": "Fat loss",
  "减肥/减重": "Weight loss",
  "健康管理": "Health",
  "普通日": "Normal day",
  "高碳日": "High-carb day",
  "低碳日": "Low-carb day",
  "高蛋白日": "High-protein day",
  "放纵日": "Free day",
  "新手推荐，休息日也默认用这个。": "Recommended for beginners and rest days.",
  "适合腿、背、全身或高强度训练。": "Best for legs, back, full-body, or high-intensity sessions.",
  "适合休息日或轻训练日。": "Best for rest days or light training days.",
  "适合训练后恢复或减脂保肌肉。": "Best for post-training recovery or fat loss while keeping muscle.",
  "可以灵活吃，但系统仍帮你盯住边界。": "Eat flexibly while the system watches your limits.",
  "三分化": "Push/Pull/Legs",
  "五分化": "5-day split",
  "功能性训练": "Functional training",
  "徒手训练": "Bodyweight training",
  "不训练": "Not training",
  "三餐正常": "Regular 3 meals",
  "16+8 间歇性断食": "16:8 intermittent fasting",
  "碳循环": "Carb cycling",
  "地中海 / 均衡饮食": "Mediterranean / balanced",
  "外卖 / 便利店为主": "Takeout / convenience store",
  "不确定，先按普通模式算": "Not sure, use normal mode",
  "全身": "Full body",
  "胸": "Chest",
  "背": "Back",
  "腿": "Legs",
  "肩": "Shoulders",
  "手臂": "Arms",
  "腹": "Abs",
  "下一餐，": "Your next meal,",
  "不靠猜。": "no guessing.",
  "记录生活，": "Record life,",
  "看懂每一餐。": "make sense of every meal.",
  "当前营养完成度较高，优先推荐水果、酸奶或轻量加餐。": "You're already close to your target, so I'm prioritizing fruit, yogurt, or light top-ups.",
  "根据已有饮食记录、训练状态和营养缺口生成推荐。": "Recommendations are based on your logged meals, training status, and remaining nutrient gaps.",
  "蛋白还差": "Protein remaining",
  "热量余量": "Calories remaining",
  "识别完成：{count} 个食物已进入确认区，营养变化正在计算。": "Recognition completed: {count} item(s) have been added to the confirmation area and nutritional changes are being calculated.",
  "今日完成": "Today's completion",
  "蛋白缺口": "Protein gap",
  "已记录": "Logged",
  "餐": "meal",
  "帮我选一个": "Pick for me",
  "AI 生成更多": "AI: more ideas",
  "重新识别食物": "Log food again",
  "此刻最合适": "Best fit right now",
  "就吃这个": "Choose this",
  "推荐方案": "Recommendations",
  "{count} 个匹配方案": "{count} matching plans",
  "轻补模式": "Light top-up mode",
  "平衡正餐模式": "Balanced meal mode",
  "餐饮地域": "Cuisine",
  "餐别": "Meal slot",
  "品类": "Category",
  "这个筛选组合暂时没有候选": "No matches for these filters",
  "可以放宽一个筛选项，或者点 AI 再推荐 30 种。": "Try removing a filter, or ask AI for 30 more ideas.",
  "随机推荐": "Random pick",
  "关闭随机推荐": "Close random pick",
  "摇到了": "Your pick",
  "正在为你翻牌": "Shuffling...",
  "吃完预计达成": "Estimated after eating",
  "就吃摇到的": "Choose the pick",
  "再摇一次": "Shuffle again",
  "先看这个": "Preview",
  "选择这个": "Choose this",
  "平均": "Average",
  "AI 正在从系统食物库里帮你补 {count} 种候选...": "AI is adding {count} candidates from the food library...",
  "AI 推荐暂时没有生成成功，先用本地推荐池。": "AI couldn't generate recommendations, so I'm using the local pool.",
  "AI 新增了 {count} 个候选，已经混进推荐池。": "AI added {count} candidates to the recommendation pool.",
  "AI 暂时没有给出新候选，先用本地推荐池。": "AI didn't return new candidates, so I'm using the local pool.",
  "AI 推荐请求失败了，先用本地推荐池。": "The AI recommendation request failed, so I'm using the local pool.",
  "全部": "All",
  "中餐": "Chinese",
  "西餐": "Western",
  "全部餐别": "All meal slots",
  "早餐": "Breakfast",
  "午餐 / 晚餐": "Lunch / dinner",
  "夜宵": "Late-night",
  "轻补": "Light top-up",
  "全部品类": "All categories",
  "早餐早点": "Breakfast",
  "家常菜 / 炒菜": "Home-style / stir-fry",
  "火锅": "Hot pot",
  "麻辣烫 / 冒菜": "Malatang / maocai",
  "韩式烤肉": "Korean BBQ",
  "日料": "Japanese",
  "烧烤 / 烤串": "BBQ / skewers",
  "牛排": "Steak",
  "粉面 / 快餐": "Noodles / fast food",
  "汉堡 / 西式快餐": "Burgers / Western fast food",
  "奶茶 / 咖啡": "Milk tea / coffee",
  "便利店": "Convenience store",
  "轻食": "Light meal",
  "水果零食": "Fruit & snacks",
  "健身补剂": "Supplements",
  "正餐方案": "Full meal",
  "轻加餐": "Light top-up",
  "零食 / 夜宵": "Snack / late-night",
  "推荐早饭": "Breakfast idea",
  "推荐夜宵": "Late-night idea",
  "推荐午饭 / 晚饭 / 夜宵": "Lunch / dinner / late-night idea",
  "推荐轻补 / 夜宵": "Light top-up / late-night idea",
  "写好描述并点击“让 AI 根据描述估算”后，这里会出现可编辑的食物条目。": "After you write a description and click \"Let AI estimate from the description\", editable food items will appear here.",
  "本次识别合计": "This recognition total",
  "共 {count} 个食物条目，编辑或删除后会自动更新。": "{count} food items in total. Edits or deletions update automatically.",
  "根据描述估算": "Estimate from description",
  "让 AI 根据描述估算": "Let AI estimate from description",
  "AI 正在解析": "AI is parsing",
  "使用系统推荐": "Use system recommendation",
  "返回修改设置": "Back to settings",
  "确认并保存": "Confirm & save",
  "体脂率评判标准图": "Body fat reference chart",
  "用真人体脂对照图做视觉参考，再配合区间判断目标。不同身高、骨架和肌肉量会让观感有差异。": "Use real-body reference photos for a visual check and a range-based goal. Height, frame size, and muscle mass can affect how body fat looks.",
  "男生参考": "Men",
  "女生参考": "Women",
  "知识库估算，可按实际份量微调。": "Estimated from the knowledge base; adjust portions to match what you actually eat."
};

export function translateToEn(text: string, vars?: Record<string, string | number>) {
  let translated = zhToEn[text] ?? generatedZhToEn[text] ?? text;

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      translated = translated.replaceAll(`{${key}}`, String(value));
    }
  }

  return translated;
}


const enToZh = new Map<string, string>();
const enToZhLower = new Map<string, string>();

for (const [zh, en] of Object.entries(generatedZhToEn)) {
  if (!en) continue;
  enToZh.set(en, zh);
  enToZhLower.set(en.toLowerCase(), zh);
}

for (const [zh, en] of Object.entries(zhToEn)) {
  if (!en) continue;
  enToZh.set(en, zh);
  enToZhLower.set(en.toLowerCase(), zh);
}

export function translateToZh(text: string, vars?: Record<string, string | number>) {
  let translated = enToZh.get(text) ?? enToZhLower.get(text.toLowerCase()) ?? text;

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      translated = translated.replaceAll(`{${key}}`, String(value));
    }
  }

  return translated;
}

type FoodTextField = "name" | "brand" | "foodType" | "portionLabel" | "warning" | "sourceLabel";

export function getLocalizedFoodField(food: FoodLogItem, field: FoodTextField, language: Language) {
  const record = food as unknown as Record<string, string | undefined>;
  const localized = record[`${field}${language === "en" ? "En" : "Zh"}`];
  if (localized) return localized;

  const base = record[field];
  if (!base) return "";

  return language === "en" ? translateToEn(base) : translateToZh(base);
}
