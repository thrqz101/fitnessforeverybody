import { type Language, pick } from "@/shared/i18n/i18n-utils";
import { foodRouterMode } from "@/features/recognition/domain/food-router";
import { getBrandCatalogPrompt } from "@/features/recognition/domain/brand-catalog";
import { getStrictLocalMatchPrompt } from "@/features/recognition/domain/local-match";
import type { StrictLocalFoodMatch } from "@/features/recognition/domain/types";

export const maxRecognizedFoodItems = 6;

export function outputLanguageInstruction(language: Language) {
  const targetInstruction =
    language === "en"
      ? "All user-facing text fields (name, brand, foodType, portionLabel, warning, message) must be written in English."
      : "所有面向用户的字段 name、brand、foodType、portionLabel、warning、message 必须使用中文。";

  if (foodRouterMode(process.env.FOOD_ROUTER) !== "llm") {
    return `${targetInstruction} 只输出当前语言字段，不输出中英文镜像字段。Keep macro JSON keys as protein, carbs, fat, calories, fiber.`;
  }
  return `${targetInstruction} Also include bilingual mirror fields for every food: nameZh, nameEn, brandZh, brandEn, foodTypeZh, foodTypeEn, portionLabelZh, portionLabelEn, warningZh, warningEn, sourceLabelZh, sourceLabelEn. The Zh fields must always be Chinese; the En fields must always be English. Keep macro JSON keys as protein, carbs, fat, calories, fiber.`;
}

export function localized(language: Language, zh: string, en: string) {
  return pick(language, zh, en);
}

export function getChinesePortionBaselinePrompt() {
  return [
    "份量原则：不套固定菜品案例或克重表；按用户描述、菜系/品类、烹调方式、售卖规格和行业平均估算真实中位值。",
    "用户给了克数、个数、规格、大小份、人数、分食或剩余比例时优先使用；未写明时按普通成年人一次正常摄入估算，不默认大份/小份/偏高。",
    "多人共享餐按当前用户的实际摄入份额计算；共享菜分摊，个人主食/饮料/小吃单独计算，人数不明时说明假设。",
    "注意生熟重、可食部分、干湿重和酱汁油脂；关键假设写进 portionLabel，warning 保持很短。"
  ].join("\n");
}

/** The main estimation prompt: only the foods still left to analyse, with local matches as fixed context. */
export function buildEstimatePrompt(language: Language, description: string, analysisDescription: string, strictLocalMatches: StrictLocalFoodMatch[]) {
  return [
    "你是中国餐饮场景的自然语言营养估算助手。只返回严格 JSON 对象，不要 Markdown，不要解释。",
    outputLanguageInstruction(language),
    "任务：根据用户本次文字描述，把每个食物拆成 foods，并估算营养素。",
    "如果用户没有说具体食物、品牌、菜品、套餐、配料或份量，例如只说“我今天吃什么”，返回 isFoodRelated=false 和空 foods，不要硬猜。",
    "品牌+产品优先；识别不出品牌时，用同品类行业平均估算，recognitionMode=industry-average。",
    "只有真实的品牌或有名字的具体店铺（如“麦当劳”“小林面馆”）才填 brand；“楼下面馆”“公司食堂”“路边摊”“外卖”“家里做的”这类泛指的地点或店铺类型不是品牌，brand 留空。",
    getBrandCatalogPrompt(description),
    getStrictLocalMatchPrompt(strictLocalMatches),
    "普通自然语言描述优先按中国餐饮行业平均估算，不要套用固定菜单模板。",
    "严格只按用户写出的食物、配菜、主食和饮料估算；用户没有写到的项目不要自行添加。",
    "不要把不完全一致的组合当成同一种食物；组合餐要拆成不重叠条目，或合成一个完整组合。",
    "遇到盖饭、盖浇饭、粉面、麻辣烫、火锅、素菜拼盘、套餐时，严格按用户实际写出的主食、配菜、饮料和份量估算。",
    getChinesePortionBaselinePrompt(),
    `最多输出 ${maxRecognizedFoodItems} 个 foods；如果用户列出超过 ${maxRecognizedFoodItems} 个具体食物，返回空 foods 并提醒分批输入。`,
    "多食物必须拆开，但不要生成互相包含的重复套餐。",
    "每个 food 必须有 name、brand、foodType、portionLabel、meal、macros、recognitionMode、warning。",
    "macros 包含 protein/carbs/fat/calories/fiber，单位 g/g/g/kcal/g，四舍五入为整数。",
    "warning 是给用户的简短营养行动建议；高油、高糖、低纤维或精制主食偏多时，写成去皮少油、换无糖饮料、搭配蔬菜、部分主食换杂粮等具体做法；无需提醒时可为空。",
    "warning 最多 24 个中文字，不写说教或疾病判断。不在message或warning中描述数据库、模型、LLM或来源渠道。",
    "校验：calories 应大致等于 protein*4 + carbs*4 + fat*9，误差超过 25% 时先修正宏量营养素或热量。",
    "返回 JSON 字段：isFoodRelated、message、foods；food 字段同上。",
    `本次只需分析的食物：${analysisDescription || "无"}`
  ].filter(Boolean).join("\n");
}
