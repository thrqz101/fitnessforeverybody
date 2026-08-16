"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const percent = completion(value, target);
  const animated = useAnimatedProgress(value, percent);
  const width = Math.min(animated.percent, 125);
  const isOver = animated.percent > 105;
  const meta = macroLabels[macro];

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black text-ink">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneByMacro[macro]}`} />
            {t(meta.label)}
          </p>
          {!compact ? (
            <p className="text-xs text-ink/55">
              {Math.round(animated.value)} / {Math.round(target)}
              {meta.unit}
            </p>
          ) : null}
        </div>
        <span className={`text-base font-black ${isOver ? "text-coral" : "text-ink"}`}>
          {Math.round(animated.percent)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className={`h-full rounded-full ${toneByMacro[macro]} transition-all duration-700 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
      {compact ? (
        <p className="text-xs text-ink/55">
          {Math.round(animated.value)} / {Math.round(target)}
          {meta.unit}
        </p>
      ) : null}
    </div>
  );
}

function useAnimatedProgress(targetValue: number, targetPercent: number) {
  const [displayed, setDisplayed] = useState({ value: 0, percent: 0 });
  const displayedRef = useRef(displayed);

  useEffect(() => {
    const from = displayedRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 1 : 1500;
    const startedAt = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = {
        value: from.value + (targetValue - from.value) * eased,
        percent: from.percent + (targetPercent - from.percent) * eased
      };
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [targetPercent, targetValue]);

  return displayed;
}
