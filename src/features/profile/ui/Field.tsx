"use client";

import { formatNumberInputValue } from "@/shared/ui/number-input";

export function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      <input
        className="h-12 rounded-[18px] border border-ink/12 bg-paper px-3 text-ink"
        type="number"
        min="0"
        value={formatNumberInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
