import type { DayState, FoodLogItem, MacroTotals, MealType } from "../types";
import { foodToEntryPayload, sanitizeMacros } from "./mappers";
import { coerceDay } from "./validate";

export type ImportFood = {
  clientId: string; name: string; brand: string | null; meal: string;
  baseMacros: MacroTotals; macros: MacroTotals; portionScale: number; item: Record<string, unknown>;
};
export type ImportRecord = { date: string; day: DayState; foods: ImportFood[] };
export type ImportPayload = { records: ImportRecord[]; dayCount: number; foodCount: number };

const MAX_DAYS = 400;
const MAX_FOODS_PER_DAY = 100;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const meals: MealType[] = ["breakfast", "lunch", "dinner", "snack", "midnight"];

function build(records: ImportRecord[]): ImportPayload {
  const kept = records.filter((record) => record.foods.length > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_DAYS);
  return { records: kept, dayCount: kept.length, foodCount: kept.reduce((sum, record) => sum + record.foods.length, 0) };
}

/** Turns the old localStorage day records ({dateKey: {day, foods}}) into an import payload; saved foods only. */
export function legacyToImport(raw: string | null, todayKey: string): ImportPayload {
  let parsed: unknown;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { return build([]); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return build([]);
  const records: ImportRecord[] = [];
  for (const [date, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!datePattern.test(date) || date > todayKey || !value || typeof value !== "object") continue;
    const record = value as { day?: unknown; foods?: unknown };
    const foods: ImportFood[] = [];
    (Array.isArray(record.foods) ? (record.foods as Partial<FoodLogItem>[]) : []).forEach((food, index) => {
      if (!food || typeof food !== "object" || food.savedToCalendar === false) return;
      const payload = foodToEntryPayload(food as FoodLogItem, "manual");
      if (!payload.baseMacros || foods.length >= MAX_FOODS_PER_DAY) return;
      foods.push({
        clientId: `${date}:${String(food.id ?? index)}`.slice(0, 80),
        name: payload.name, brand: payload.brand, meal: payload.meal,
        baseMacros: payload.baseMacros, macros: sanitizeMacros(food.macros) ?? payload.baseMacros,
        portionScale: payload.portionScale, item: payload.item
      });
    });
    records.push({ date, day: coerceDay(record.day), foods });
  }
  return build(records);
}

/** Server-side re-validation of a client-built payload. Returns null for a malformed structure. */
export function sanitizeImport(input: unknown, todayKey: string): ImportPayload | null {
  const list = (input as { records?: unknown } | null)?.records;
  if (!Array.isArray(list) || list.length > MAX_DAYS) return null;
  const records: ImportRecord[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") return null;
    const raw = entry as { date?: unknown; day?: unknown; foods?: unknown };
    if (typeof raw.date !== "string" || !datePattern.test(raw.date) || raw.date > todayKey) return null;
    if (!Array.isArray(raw.foods) || raw.foods.length > MAX_FOODS_PER_DAY) return null;
    const foods: ImportFood[] = [];
    for (const item of raw.foods as Record<string, unknown>[]) {
      const baseMacros = sanitizeMacros(item?.baseMacros);
      const macros = sanitizeMacros(item?.macros);
      const scale = typeof item?.portionScale === "number" ? item.portionScale : 1;
      const name = typeof item?.name === "string" ? item.name.trim().slice(0, 200) : "";
      const clientId = typeof item?.clientId === "string" ? item.clientId.slice(0, 80) : "";
      const body = item?.item && typeof item.item === "object" && !Array.isArray(item.item) ? (item.item as Record<string, unknown>) : {};
      if (!baseMacros || !macros || !name || !clientId || !(scale >= 0.1 && scale <= 10) || JSON.stringify(body).length > 30_000) continue;
      foods.push({
        clientId, name, brand: typeof item.brand === "string" ? item.brand.slice(0, 200) : null,
        meal: meals.includes(item.meal as MealType) ? (item.meal as string) : "snack", baseMacros, macros, portionScale: scale, item: body
      });
    }
    records.push({ date: raw.date, day: coerceDay(raw.day), foods });
  }
  return build(records);
}
