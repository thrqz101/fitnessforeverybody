"use client";

import type { FoodLogItem } from "@/shared/domain/types";
import { useI18n } from "@/shared/i18n/i18n";
import { getLocalizedFoodField } from "@/shared/i18n/translations";
import { macroKeys } from "@/shared/domain/nutrition";
import { macroLabels } from "@/shared/domain/labels";

export function MealMacroGrid({ food }: { food: FoodLogItem }) {
  const { t, language } = useI18n();
  return (
    <div className="meal-entry__macros" aria-label={`${getLocalizedFoodField(food, "name", language)} ${t("的营养含量")}`}>
      {macroKeys.map((macro) => (
        <span key={macro}>
          <strong>{Math.round(food.macros[macro])}{macroLabels[macro].unit}</strong>
          {t(macroLabels[macro].short)}
        </span>
      ))}
    </div>
  );
}

export function getFoodHealthTip(food: FoodLogItem) {
  const details = `${food.name} ${food.foodType} ${food.warning ?? ""}`;

  if (/奶茶|可乐|含糖|甜饮|果茶|糖浆/.test(details)) return "饮料换成无糖版本，减少额外糖分";
  if (/炸|酥|鸡皮|油碟|烧烤|烤肉|重油/.test(details) || food.macros.fat >= 28) return "去皮少油，再搭配一份蔬菜";
  if (/米饭|盖饭|炒饭|面|粉/.test(details) && food.macros.fiber < 5) return "部分精制主食换成杂粮或薯类";
  if (food.macros.calories >= 450 && food.macros.fiber < 5) return "补一份蔬菜，提高这一餐的纤维";
  if (food.warning && /少油|无糖|换成|搭配|补一份|减少|控制/.test(food.warning)) return food.warning;
  return null;
}
