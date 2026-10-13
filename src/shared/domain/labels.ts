import type { GoalType, MacroKey, DietDayStatus } from "@/shared/domain/types";

export const goalLabels: Record<GoalType, string> = {
  muscle: "增肌",
  fat_loss: "减脂",
  weight_loss: "减肥/减重",
  health: "健康管理"
};

export const macroLabels: Record<MacroKey, { label: string; unit: string; short: string }> = {
  protein: { label: "蛋白质", unit: "g", short: "蛋白" },
  carbs: { label: "碳水", unit: "g", short: "碳水" },
  fat: { label: "脂肪", unit: "g", short: "脂肪" },
  calories: { label: "热量", unit: "kcal", short: "热量" },
  fiber: { label: "膳食纤维", unit: "g", short: "纤维" }
};

export const dietStatusLabels: Record<DietDayStatus, { label: string; detail: string }> = {
  normal: { label: "普通日", detail: "新手推荐，休息日也默认用这个。" },
  high_carb: { label: "高碳日", detail: "适合腿、背、全身或高强度训练。" },
  low_carb: { label: "低碳日", detail: "适合休息日或轻训练日。" },
  high_protein: { label: "高蛋白日", detail: "适合训练后恢复或减脂保肌肉。" },
  free: { label: "放纵日", detail: "可以灵活吃，但系统仍帮你盯住边界。" }
};
