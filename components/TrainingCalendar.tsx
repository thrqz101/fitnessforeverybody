"use client";

import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Dumbbell, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDateKey, getMonthGrid, shiftMonth } from "@/lib/dates";
import { completion, dietStatusLabels, goalLabels, macroKeys, macroLabels, sumFoods } from "@/lib/nutrition";
import type { DayRecord, DayState, FoodLogItem, MacroKey, MacroTotals, UserProfile } from "@/lib/types";

type TrainingCalendarProps = {
  profile: UserProfile;
  day: DayState;
  foods: FoodLogItem[];
  records: Record<string, DayRecord>;
  currentDateKey: string;
  selectedDateKey: string;
  targets: MacroTotals;
  totals: MacroTotals;
  todayLabel: string;
  onSelectDate: (dateKey: string) => void;
  onDayChange?: (day: DayState) => void;
};

const trainingParts = ["胸", "背", "腿", "肩", "手臂", "腹", "全身", "休息"];
const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];
const progressToneByMacro: Record<MacroKey, string> = {
  protein: "#4f805d",
  carbs: "#e9bd45",
  fat: "#eb765f",
  calories: "#31505a",
  fiber: "#78aeb5"
};

export function TrainingCalendar({
  profile,
  day,
  foods,
  records,
  currentDateKey,
  selectedDateKey,
  targets,
  totals,
  todayLabel,
  onSelectDate,
  onDayChange
}: TrainingCalendarProps) {
  const [monthKey, setMonthKey] = useState(selectedDateKey.slice(0, 7));
  const cells = useMemo(() => getMonthGrid(monthKey), [monthKey]);
  const editable = selectedDateKey === currentDateKey && Boolean(onDayChange);
  const trainingFieldsDisabled = !editable || !day.isTrainingDay;
  const selectedLabel = selectedDateKey === currentDateKey ? `今天 · ${todayLabel}` : formatDateKey(selectedDateKey);
  const completionAverage = Math.round(
    macroKeys.reduce((sum, key) => sum + Math.min(totals[key] / Math.max(targets[key], 1), 1), 0) / macroKeys.length * 100
  );

  useEffect(() => {
    setMonthKey(selectedDateKey.slice(0, 7));
  }, [selectedDateKey]);

  return (
    <div className="progress-experience">
      <section className="progress-overview">
        <div className="progress-overview__copy">
          <span className="experience-kicker">Daily progress</span>
          <h1>营养与训练</h1>
          <p>把今天吃了什么、完成了多少和训练节奏放在一处，切换日期即可回看每日变化。</p>
        </div>
        <div className="progress-overview__dashboard">
          <div className="progress-overview__ring" style={{ background: `conic-gradient(#4f805d ${completionAverage}%, rgba(79,128,93,.12) 0)` }}>
            <div><strong>{completionAverage}%</strong><span>今日营养达标率</span></div>
          </div>
          <div className="progress-overview__facts">
            <span><small>饮食记录</small><strong>{foods.length}<i> 餐</i></strong></span>
            <span><small>训练时长</small><strong>{day.durationMinutes}<i> 分钟</i></strong></span>
            <span><small>今日节奏</small><strong>{day.isTrainingDay ? day.trainingPart : "恢复"}</strong></span>
          </div>
        </div>
      </section>

      <div className="progress-workspace">
      <section className="wellness-card p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Calendar</p>
            <h1 className="mt-1 text-3xl font-black text-ink">训练和饮食日历</h1>
            <p className="mt-2 text-sm leading-6 text-ink/58">按北京时间 0:00-24:00 自动分天。</p>
          </div>
          <CalendarDays className="text-moss" size={30} aria-hidden="true" />
        </div>

        <div className="rounded-[24px] border border-ink/10 bg-paper/80 p-3">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthKey((current) => shiftMonth(current, -1))}
              aria-label="上个月"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[18px] border border-ink/12 bg-white text-ink"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <p className="text-base font-black text-ink">{monthKey.replace("-", "年")}月</p>
            <button
              type="button"
              onClick={() => setMonthKey((current) => shiftMonth(current, 1))}
              aria-label="下个月"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[18px] border border-ink/12 bg-white text-ink"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekLabels.map((label) => (
              <div key={label} className="py-2 text-center text-xs font-black text-ink/45">
                {label}
              </div>
            ))}
            {cells.map((cell) => {
              const record = records[cell.dateKey];
              const recordTotals = record ? sumFoods(record.foods) : null;
              const hasFood = Boolean(record?.foods.length);
              const selected = cell.dateKey === selectedDateKey;
              const today = cell.dateKey === currentDateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => onSelectDate(cell.dateKey)}
                  className={`min-h-[74px] rounded-[18px] border p-2 text-left transition ${
                    selected
                      ? "border-coral bg-coral/10"
                      : today
                        ? "border-moss bg-mint/55"
                        : "border-ink/8 bg-white"
                  } ${cell.inMonth ? "opacity-100" : "opacity-45"}`}
                >
                  <span className="text-sm font-black text-ink">{cell.day}</span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {record?.day.isTrainingDay ? <Dot label="练" tone="moss" /> : null}
                    {hasFood ? <Dot label="吃" tone="coral" /> : null}
                  </div>
                  {recordTotals ? (
                    <p className="mt-1 truncate text-[11px] font-bold text-ink/42">
                      {Math.round(recordTotals.calories)} kcal
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-5">
        <div className="wellness-card p-5 sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-moss">Selected Day</p>
              <h2 className="mt-1 text-2xl font-black text-ink">{selectedLabel}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/58">
                {editable ? "今天可以直接编辑；过往日期目前用于查看记录。" : "这是历史记录视图，今天的训练状态请点回今天编辑。"}
              </p>
            </div>
            {selectedDateKey !== currentDateKey ? (
              <button
                type="button"
                onClick={() => onSelectDate(currentDateKey)}
                className="inline-flex h-10 items-center justify-center rounded-[18px] bg-ink px-4 text-sm font-black text-white"
              >
                回到今天
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <div className="rounded-[18px] border border-ink/10 bg-paper p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-black text-ink">
                <Dumbbell size={17} aria-hidden="true" />
                是否训练
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!editable}
                  aria-pressed={day.isTrainingDay}
                  onClick={() => onDayChange?.({ ...day, isTrainingDay: true, trainingPart: day.trainingPart === "休息" ? "全身" : day.trainingPart })}
                  className={`h-11 rounded-[18px] border text-sm font-black disabled:cursor-not-allowed disabled:opacity-55 ${day.isTrainingDay ? "border-moss bg-moss text-white" : "border-ink/12 bg-white text-ink"}`}
                >
                  训练
                </button>
                <button
                  type="button"
                  disabled={!editable}
                  aria-pressed={!day.isTrainingDay}
                  onClick={() => onDayChange?.({ ...day, isTrainingDay: false, trainingPart: "休息", trainingSets: 0, durationMinutes: 0, dietStatus: "normal" })}
                  className={`h-11 rounded-[18px] border text-sm font-black disabled:cursor-not-allowed disabled:opacity-55 ${!day.isTrainingDay ? "border-ink bg-ink text-white" : "border-ink/12 bg-white text-ink"}`}
                >
                  休息
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-bold text-ink">
                练了哪里
                <select
                  disabled={trainingFieldsDisabled}
                  className="h-11 rounded-[18px] border border-ink/12 bg-paper px-3 disabled:cursor-not-allowed disabled:opacity-60"
                  value={day.trainingPart}
                  onChange={(event) => onDayChange?.({ ...day, trainingPart: event.target.value, isTrainingDay: event.target.value !== "休息" })}
                >
                  {trainingParts.map((part) => (
                    <option key={part}>{part}</option>
                  ))}
                </select>
              </label>
              <CalendarNumber disabled={trainingFieldsDisabled} label="练了几组" value={day.isTrainingDay ? day.trainingSets : 0} onChange={(value) => onDayChange?.({ ...day, trainingSets: value })} />
              <CalendarNumber disabled={trainingFieldsDisabled} label="练了多久 min" value={day.isTrainingDay ? day.durationMinutes : 0} onChange={(value) => onDayChange?.({ ...day, durationMinutes: value })} />
            </div>

            <label className="grid gap-2 text-sm font-bold text-ink">
              今日饮食状态
              <select
                disabled={!editable}
                className="h-12 rounded-[18px] border border-ink/12 bg-paper px-3 disabled:cursor-not-allowed disabled:opacity-60"
                value={day.dietStatus}
                onChange={(event) => onDayChange?.({ ...day, dietStatus: event.target.value as DayState["dietStatus"] })}
              >
                {Object.entries(dietStatusLabels).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label} - {meta.detail}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-[18px] border border-moss/18 bg-mint/50 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-moss">
                <CheckCircle2 size={17} aria-hidden="true" />
                日期摘要
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/68">
                {profile.trainingStyle} · {day.isTrainingDay ? `练${day.trainingPart}，${day.trainingSets} 组，${day.durationMinutes} 分钟` : "休息日"} ·
                饮食状态：{dietStatusLabels[day.dietStatus].label}
              </p>
            </div>
          </div>
        </div>

        <div className="wellness-card day-nutrition-card">
          <div className="day-nutrition-card__heading">
            <div>
              <p className="experience-kicker">Nutrition target</p>
              <h2>当日营养进度</h2>
              <p>{goalLabels[profile.goal]}目标 · 五项指标共同计算达标率</p>
            </div>
            <span className="day-nutrition-card__score"><strong>{completionAverage}%</strong>整体达标</span>
          </div>
          <div className="day-nutrient-grid">
            {macroKeys.map((macro) => {
              const percent = completion(totals[macro], targets[macro]);
              const tone = progressToneByMacro[macro];
              return (
                <article key={macro} className="day-nutrient-row">
                  <span className="day-nutrient-row__ring" style={{ background: `conic-gradient(${tone} ${Math.min(percent, 100)}%, rgba(29,42,34,.08) 0)` }}>
                    <i>{percent}%</i>
                  </span>
                  <div className="day-nutrient-row__copy">
                    <div>
                      <strong>{macroLabels[macro].label}</strong>
                      <span>{Math.round(totals[macro])} / {Math.round(targets[macro])}{macroLabels[macro].unit}</span>
                    </div>
                    <span className="day-nutrient-row__bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(percent, 100)}%`, background: tone }} />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="wellness-card p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-black text-moss">
            <Utensils size={17} aria-hidden="true" />
            这天吃了什么
          </p>
          <p className="mt-1 text-xs font-semibold text-ink/45">这里只显示已经保存到日历的记录，保存后不可删除。</p>
          {foods.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {foods.slice(0, 10).map((food) => (
                <article key={food.id} className="rounded-[18px] border border-ink/10 bg-paper p-3">
                  <p className="text-sm font-black text-ink">{food.name}</p>
                  <p className="mt-1 text-xs text-ink/52">{food.brand ?? "未标品牌"} · {food.foodType ?? "食品"}</p>
                  <p className="mt-2 text-xs text-ink/62">
                    蛋白 {Math.round(food.macros.protein)}g · 碳水 {Math.round(food.macros.carbs)}g · 脂肪 {Math.round(food.macros.fat)}g
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-[18px] border border-dashed border-ink/18 bg-paper p-4 text-sm text-ink/58">
              这天还没有保存到日历的食物记录。今天的草稿需要点“保存到日历”后才会出现在这里。
            </p>
          )}
        </div>
      </section>
      </div>
    </div>
  );
}

function Dot({ label, tone }: { label: string; tone: "moss" | "coral" }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tone === "moss" ? "bg-moss text-white" : "bg-coral text-white"}`}>
      {label}
    </span>
  );
}

function CalendarNumber({
  label,
  value,
  onChange,
  disabled
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-ink">
      {label}
      <input
        className="h-11 rounded-[18px] border border-ink/12 bg-paper px-3 disabled:cursor-not-allowed disabled:opacity-60"
        min="0"
        type="number"
        disabled={disabled}
        value={formatNumberInputValue(value)}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}

function formatNumberInputValue(value: number) {
  if (!Number.isFinite(value) || value === 0) return "";
  return value;
}
