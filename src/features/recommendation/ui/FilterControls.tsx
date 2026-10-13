"use client";

import type { ReactNode } from "react";

export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-2 sm:grid-cols-[88px_1fr] sm:items-start">
      <p className="pt-1 text-xs font-black uppercase tracking-[0.16em] text-moss">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-xs font-black transition ${
        active
          ? "border-moss bg-moss text-white shadow-soft"
          : "border-ink/10 bg-white text-ink/66 hover:border-moss/35 hover:text-moss"
      }`}
    >
      {children}
    </button>
  );
}
