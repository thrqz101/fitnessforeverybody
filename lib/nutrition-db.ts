import fs from "node:fs";
import path from "node:path";
import type { MacroTotals } from "@/lib/types";
import exampleDb from "@/data/nutrition-100g.example.json";

export type NutritionItem = {
  name: string;
  nameEn?: string;
  category?: string;
  aliases?: string[];
  per100g: MacroTotals;
};

export type NutritionDb = {
  version: string;
  source: string;
  unit: "per_100g";
  note?: string;
  foods: NutritionItem[];
};

export type DbMeta = {
  version: string;
  source: string;
  unit: string;
  count: number;
};

export type MatchResult = {
  item: NutritionItem;
  score: number;
  matchType: "exact" | "alias" | "fuzzy";
  matchedTerm: string;
};

const STRIP_RE = /[，。、！？"“”‘’()（）.,;:'"!?]/g;

export function normalizeFoodText(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(STRIP_RE, "");
}

/** Prefer the gitignored full local DB on disk; fallback to the committed sample. */
export function getNutritionDb(): NutritionDb {
  try {
    const candidate = path.join(process.cwd(), "data", "nutrition-100g.json");
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw) as NutritionDb;
      if (parsed && Array.isArray(parsed.foods) && parsed.foods.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fall through to bundled example
  }
  return exampleDb as NutritionDb;
}

export function getDbMeta(db: NutritionDb = getNutritionDb()): DbMeta {
  return {
    version: db.version,
    source: db.source,
    unit: db.unit,
    count: db.foods.length
  };
}

function itemSearchTerms(item: NutritionItem): string[] {
  return [item.name, item.nameEn, ...(item.aliases ?? [])].map((t) => normalizeFoodText(t ?? "")).filter(Boolean);
}

/**
 * CJK-friendly fuzzy match: exact / alias / token-overlap scoring.
 * Because Chinese food names have no spaces, we compare on normalized strings
 * and character overlap instead of word tokens.
 */
export function searchNutritionDb(query: string, limit = 5): MatchResult[] {
  const db = getNutritionDb();
  const q = normalizeFoodText(query);
  if (!q) return [];

  const scored: MatchResult[] = [];
  for (const item of db.foods) {
    const terms = itemSearchTerms(item);
    let score = 0;
    let matchType: MatchResult["matchType"] = "fuzzy";
    let matchedTerm = item.name;

    for (const term of terms) {
      if (q === term) {
        score = Math.max(score, 100);
        matchType = "exact";
        matchedTerm = term;
      } else if (term && (q.includes(term) || term.includes(q))) {
        score = Math.max(score, 55 + Math.min(term.length, q.length));
        matchType = "alias";
        matchedTerm = term;
      }
    }

    const primary = normalizeFoodText(item.name);
    if (score === 0 && primary) {
      if (primary.includes(q)) {
        score = Math.max(score, 62);
        matchType = "fuzzy";
        matchedTerm = item.name;
      } else if (q.includes(primary)) {
        score = Math.max(score, 56);
        matchType = "fuzzy";
        matchedTerm = item.name;
      } else {
        const chars = Array.from(new Set(q.split("")));
        const overlap = chars.filter((c) => primary.includes(c)).length;
        const ratio = overlap / Math.max(chars.length, 1);
        if (ratio >= 0.6) {
          score = Math.max(score, Math.round(ratio * 50));
          matchType = "fuzzy";
          matchedTerm = item.name;
        }
      }
    }

    if (score > 0) scored.push({ item, score, matchType, matchedTerm });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function scalePer100gToGrams(macros: MacroTotals, grams: number): MacroTotals {
  const m = grams / 100;
  return {
    protein: Math.round(macros.protein * m),
    carbs: Math.round(macros.carbs * m),
    fat: Math.round(macros.fat * m),
    calories: Math.round(macros.calories * m),
    fiber: Math.round(macros.fiber * m)
  };
}
