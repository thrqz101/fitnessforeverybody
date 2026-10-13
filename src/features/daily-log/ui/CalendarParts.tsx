"use client";

import { formatNumberInputValue } from "@/shared/ui/number-input";

export function Dot({ label, tone }: { label: string; tone: "moss" | "coral" }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tone === "moss" ? "bg-moss text-white" : "bg-coral text-white"}`}>
      {label}
    </span>
  );
}

export function CalendarNumber({
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
