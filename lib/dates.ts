export function getBeijingDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
}

export function getBeijingMonthParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

export function makeDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getMonthGrid(monthKey: string) {
  const { year, month } = getBeijingMonthParts(`${monthKey}-01`);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDay = first.getUTCDay();
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const cells: Array<{ dateKey: string; day: number; inMonth: boolean }> = [];

  for (let index = firstDay - 1; index >= 0; index -= 1) {
    const prevDate = new Date(Date.UTC(year, month - 2, prevMonthDays - index));
    cells.push({
      dateKey: makeDateKey(prevDate.getUTCFullYear(), prevDate.getUTCMonth() + 1, prevDate.getUTCDate()),
      day: prevDate.getUTCDate(),
      inMonth: false
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ dateKey: makeDateKey(year, month, day), day, inMonth: true });
  }

  const tail = 42 - cells.length;
  for (let day = 1; day <= tail; day += 1) {
    const nextDate = new Date(Date.UTC(year, month, day));
    cells.push({
      dateKey: makeDateKey(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, nextDate.getUTCDate()),
      day: nextDate.getUTCDate(),
      inMonth: false
    });
  }

  return cells;
}

export function shiftMonth(monthKey: string, offset: number) {
  const { year, month } = getBeijingMonthParts(`${monthKey}-01`);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return makeDateKey(next.getUTCFullYear(), next.getUTCMonth() + 1, 1).slice(0, 7);
}

import type { Language } from "@/lib/i18n-utils";

export function formatDateKey(dateKey: string, language: Language = "zh") {
  const { year, month, day } = getBeijingMonthParts(dateKey);
  if (language === "en") {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(
      new Date(Date.UTC(year, month - 1, day))
    );
  }
  return `${year}年${month}月${day}日`;
}

export function formatMonthKey(monthKey: string, language: Language = "zh") {
  const [year, month] = monthKey.split("-").map(Number);
  if (language === "en") {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(
      new Date(Date.UTC(year, month - 1, 1))
    );
  }
  return `${year}年${month}月`;
}
