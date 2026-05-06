import { completion, macroLabels } from "@/lib/nutrition";
import type { MacroKey } from "@/lib/types";

type MacroProgressProps = {
  macro: MacroKey;
  value: number;
  target: number;
  compact?: boolean;
};

const toneByMacro: Record<MacroKey, string> = {
  protein: "bg-moss",
  carbs: "bg-citrus",
  fat: "bg-coral",
  calories: "bg-ink",
  fiber: "bg-skyglass"
};

export function MacroProgress({ macro, value, target, compact = false }: MacroProgressProps) {
  const percent = completion(value, target);
  const width = Math.min(percent, 125);
  const isOver = percent > 105;
  const meta = macroLabels[macro];

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{meta.label}</p>
          {!compact ? (
            <p className="text-xs text-ink/55">
              {Math.round(value)} / {Math.round(target)}
              {meta.unit}
            </p>
          ) : null}
        </div>
        <span className={`text-sm font-bold ${isOver ? "text-coral" : "text-ink"}`}>
          {percent}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full ${toneByMacro[macro]} transition-all duration-500`}
          style={{ width: `${width}%` }}
        />
      </div>
      {compact ? (
        <p className="text-xs text-ink/55">
          {Math.round(value)} / {Math.round(target)}
          {meta.unit}
        </p>
      ) : null}
    </div>
  );
}
