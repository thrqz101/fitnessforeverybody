"use client";

import { CheckCircle2, Dice5, Dumbbell, Keyboard, Loader2, Moon, Sparkles, Trash2, Utensils } from "lucide-react";
import { useEffect, useState } from "react";
import { MacroProgress } from "@/components/MacroProgress";
import { dietStatusLabels, estimateBmr, formatMacro, goalLabels, macroKeys, macroLabels } from "@/lib/nutrition";
import type { DayState, FoodLogItem, MacroTotals, UserProfile } from "@/lib/types";

type DashboardProps = {
  profile: UserProfile;
  day: DayState;
  targets: MacroTotals;
  totals: MacroTotals;
  gaps: MacroTotals;
  foods: FoodLogItem[];
  todayLabel: string;
  onNavigate: (view: "calendar" | "recommend" | "settings") => void;
  onDayChange: (day: DayState) => void;
  onAddFoods: (foods: FoodLogItem[]) => void;
  onRemoveFood: (id: string) => void;
  onSaveFood: (id: string) => void;
  onClearDrafts: () => void;
};

export function Dashboard({
  profile,
  day,
  targets,
  totals,
  gaps,
  foods,
  todayLabel,
  onNavigate,
  onDayChange,
  onAddFoods,
  onRemoveFood,
  onSaveFood,
  onClearDrafts
}: DashboardProps) {
  const [mealDescription, setMealDescription] = useState("");
  const [recognitionNotice, setRecognitionNotice] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const bmr = profile.bmrKcal > 0 ? profile.bmrKcal : estimateBmr(profile);
  const draftFoods = foods.filter((food) => !food.savedToCalendar);
  const savedFoods = foods.filter((food) => food.savedToCalendar);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/food-ai", {
        method: "GET",
        signal: controller.signal
      }).catch(() => {
        // Warmup is best-effort; the visible recognition flow handles real errors.
      });
    }, 800);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  async function recognizeMeal() {
    const description = mealDescription.trim();
    if (!description) {
      setRecognitionNotice("先写一下你吃了什么，比如品牌、套餐、配菜、饮料和大概份量。");
      return;
    }

    const form = new FormData();
    form.append("description", description);
    setIsRecognizing(true);
    setRecognitionNotice("正在识别这一餐的营养素...");

    try {
      const aiResult = await requestFoodAi(form);

      if (!aiResult.ok || !aiResult.result?.ok) {
        setRecognitionNotice(withRetryHint(aiResult.message || aiResult.result?.message || "AI 这次没算准。"));
        return;
      }

      const result = aiResult.result;
      const recognizedFoods = result.foods ?? [];

      if (!result.isFoodRelated || !recognizedFoods.length) {
        setRecognitionNotice("我没有测出这一餐，请输入正确的食物信息。");
        return;
      }

      onAddFoods(recognizedFoods);
      setMealDescription("");
      setRecognitionNotice(`已识别 ${recognizedFoods.length} 个食物条目，已经放进草稿箱。确认没问题后保存到日历。`);
    } catch {
      setRecognitionNotice(withRetryHint("AI 这次没接住。"));
    } finally {
      setIsRecognizing(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <section className="rounded-[8px] border border-ink/10 bg-white/88 p-5 shadow-soft sm:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-bold text-moss">{todayLabel}</p>
            <h1 className="mt-1 text-3xl font-black text-ink sm:text-4xl">今日营养摄入</h1>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              {goalLabels[profile.goal]}目标，BMR 约 {bmr} kcal，饮食结构：{profile.eatingPattern}，今日状态：{dietStatusLabels[day.dietStatus].label}。当前是
              <span className="font-bold text-ink"> {day.isTrainingDay ? "训练日" : "休息日"} </span>
              模式。
            </p>
            <p className="mt-1 text-sm leading-6 text-ink/55">
              {day.isTrainingDay ? `今天练${day.trainingPart}，${day.trainingSets} 组，${day.durationMinutes} 分钟。` : "今天休息，普通日会更适合。"}
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDayChange({ ...day, isTrainingDay: true })}
              aria-pressed={day.isTrainingDay}
              className={`inline-flex h-10 items-center gap-2 rounded-[8px] border px-3 text-sm font-bold ${
                day.isTrainingDay ? "border-moss bg-moss text-white" : "border-ink/12 bg-paper text-ink"
              }`}
            >
              <Dumbbell size={16} aria-hidden="true" />
              训练日
            </button>
            <button
              type="button"
              onClick={() => onDayChange({ ...day, isTrainingDay: false })}
              aria-pressed={!day.isTrainingDay}
              className={`inline-flex h-10 items-center gap-2 rounded-[8px] border px-3 text-sm font-bold ${
                !day.isTrainingDay ? "border-ink bg-ink text-white" : "border-ink/12 bg-paper text-ink"
              }`}
            >
              <Moon size={16} aria-hidden="true" />
              休息日
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {macroKeys.map((macro) => (
            <div key={macro} className="rounded-[8px] border border-ink/10 bg-paper p-4">
              <MacroProgress macro={macro} value={totals[macro]} target={targets[macro]} />
            </div>
          ))}
        </div>

        <section className="mt-6 rounded-[8px] border border-moss/18 bg-mint/45 p-4">
          <div className="flex items-start gap-3">
            <Keyboard className="mt-0.5 shrink-0 text-moss" size={20} aria-hidden="true" />
            <div>
              <h2 className="text-lg font-black text-ink">今天吃了什么</h2>
              <p className="mt-1 text-sm leading-6 text-ink/58">
                直接写品牌、套餐、主食、配菜、饮料和份量。识别后会先进入草稿箱，你再确认是否保存到日历。
              </p>
            </div>
          </div>
          <textarea
            className="mt-4 min-h-28 w-full resize-y rounded-[8px] border border-ink/12 bg-white p-3 text-sm leading-6 text-ink outline-none focus:border-moss"
            value={mealDescription}
            onChange={(event) => setMealDescription(event.target.value)}
            placeholder="比如：麦当劳巨无霸套餐，一个汉堡 + 中薯 + 大可乐；或者一碗麻辣烫，里面有宽粉、牛肉丸、青菜、金针菇、豆腐皮..."
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold leading-5 text-ink/52">识别结果会直接放进右侧草稿箱。</p>
            <button
              type="button"
              onClick={recognizeMeal}
              disabled={isRecognizing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-coral px-4 text-sm font-black text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isRecognizing ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
              {isRecognizing ? "正在识别" : "识别并放入草稿箱"}
            </button>
          </div>
          {recognitionNotice ? (
            <div className="mt-3 rounded-[8px] border border-coral/25 bg-coral/10 px-3 py-2 text-sm font-bold text-coral">
              {recognitionNotice}
            </div>
          ) : null}
        </section>

      </section>

      <aside className="grid gap-5">
        <section className="rounded-[8px] border border-ink/10 bg-ink p-5 text-white shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">还差多少</h2>
            <Dice5 size={22} aria-hidden="true" />
          </div>
          <div className="grid gap-3">
            {(["protein", "carbs", "fat"] as const).map((macro) => (
              <div key={macro} className="flex items-center justify-between rounded-[8px] bg-white/10 px-3 py-2">
                <span className="text-sm text-white/75">{macroLabels[macro].label}</span>
                <strong>{formatMacro(gaps[macro], macro)}</strong>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate("recommend")}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-citrus px-4 text-sm font-black text-ink"
          >
            <Utensils size={17} aria-hidden="true" />
            看能吃什么
          </button>
        </section>

        <section className="rounded-[8px] border border-ink/10 bg-white/88 p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-ink">今日记录草稿箱</h2>
              <p className="mt-1 text-xs font-semibold text-ink/50">保存到日历后会计入今日营养，且不可撤销。</p>
            </div>
            {draftFoods.length ? (
              <button
                type="button"
                onClick={onClearDrafts}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-ink/12 px-2.5 text-xs font-bold text-ink/70 hover:border-coral hover:text-coral"
              >
                <Trash2 size={14} aria-hidden="true" />
                清空草稿
              </button>
            ) : null}
          </div>

          {foods.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-ink/18 bg-paper p-5 text-sm leading-6 text-ink/58">
              还没有记录食物。先用文字描述一餐，AI 估算后会放进草稿箱。
            </div>
          ) : (
            <div className="max-h-[450px] space-y-3 overflow-auto pr-1 scrollbar-thin">
              {draftFoods.map((food) => (
                <article key={food.id} className="rounded-[8px] border border-ink/10 bg-paper p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-ink">{food.name}</p>
                      <p className="mt-1 text-xs text-ink/52">
                        {food.brand ?? "未标品牌"} · {food.foodType ?? "食品"} · {food.portionLabel}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-ink/62">
                    <span>蛋白 {Math.round(food.macros.protein)}g</span>
                    <span>碳水 {Math.round(food.macros.carbs)}g</span>
                    <span>脂肪 {Math.round(food.macros.fat)}g</span>
                  </div>
                  {food.warning ? <p className="mt-2 text-xs font-semibold text-coral">{food.warning}</p> : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <button
                      type="button"
                      onClick={() => onSaveFood(food.id)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-moss px-3 text-xs font-black text-white"
                    >
                      <CheckCircle2 size={15} aria-hidden="true" />
                      保存到日历
                    </button>
                    <span className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-coral/25 bg-coral/10 px-3 text-xs font-black text-coral">
                      不可撤销
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFood(food.id)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-ink/12 bg-white px-3 text-xs font-black text-ink/65 hover:border-coral hover:text-coral sm:col-span-2"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      删除草稿
                    </button>
                  </div>
                </article>
              ))}
              {savedFoods.length ? (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-moss">已保存到日历</p>
                  <div className="space-y-3">
                    {savedFoods.map((food) => (
                      <article key={food.id} className="rounded-[8px] border border-moss/18 bg-mint/45 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-ink">{food.name}</p>
                            <p className="mt-1 text-xs text-ink/52">
                              {food.brand ?? "未标品牌"} · {food.foodType ?? "食品"} · {food.portionLabel}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-moss px-2 py-1 text-[10px] font-black text-white">
                            不可删除
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-ink/62">
                          <span>蛋白 {Math.round(food.macros.protein)}g</span>
                          <span>碳水 {Math.round(food.macros.carbs)}g</span>
                          <span>脂肪 {Math.round(food.macros.fat)}g</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              {!draftFoods.length && savedFoods.length ? (
                <p className="rounded-[8px] border border-dashed border-ink/18 bg-paper p-4 text-sm font-semibold text-ink/55">
                  草稿箱是空的。已保存的记录会留在日历里，不能删除。
                </p>
              ) : null}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

type FoodAiResult = {
  ok?: boolean;
  isFoodRelated?: boolean;
  message?: string;
  needsConfig?: boolean;
  foods?: FoodLogItem[];
};

async function requestFoodAi(form: FormData): Promise<{
  ok: boolean;
  retryable: boolean;
  message?: string;
  result?: FoodAiResult;
}> {
  try {
    const response = await fetch("/api/food-ai", {
      method: "POST",
      body: form
    });
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    let result: FoodAiResult;

    try {
      result = await response.json();
    } catch {
      return {
        ok: false,
        retryable,
        message: retryable ? "AI 服务响应太慢或暂时不可用。" : "AI 返回内容有点乱，可以再点一次试试。"
      };
    }

    if (!response.ok || !result.ok) {
      return {
        ok: false,
        retryable: !result.needsConfig && retryable,
        message: result.message || (retryable ? "AI 服务响应太慢或暂时不可用。" : "AI 这次没算准，可以再点一次试试。"),
        result
      };
    }

    return { ok: true, retryable: false, result };
  } catch {
    return {
      ok: false,
      retryable: true,
      message: "AI 服务连接失败。"
    };
  }
}

function withRetryHint(message: string) {
  const trimmed = message.trim().replace(/[。,.，\s]+$/, "");
  if (!trimmed) return "AI 这次没接住（请再试一次）";
  if (trimmed.endsWith("（请再试一次）")) return trimmed;
  return `${trimmed}（请再试一次）`;
}
