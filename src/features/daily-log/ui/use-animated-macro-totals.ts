"use client";

import type { MacroTotals } from "@/shared/domain/types";
import { useState, useRef, useEffect } from "react";
import { macroKeys } from "@/shared/domain/nutrition";

const emptyMacroTotals: MacroTotals = { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 };

export function useAnimatedMacroTotals(target: MacroTotals) {
  const [displayed, setDisplayed] = useState<MacroTotals>(emptyMacroTotals);
  const displayedRef = useRef<MacroTotals>(emptyMacroTotals);

  useEffect(() => {
    const from = displayedRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 1 : 600;
    const startedAt = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = macroKeys.reduce((values, macro) => {
        values[macro] = from[macro] + (target[macro] - from[macro]) * eased;
        return values;
      }, { ...emptyMacroTotals });
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return displayed;
}
