import fs from "node:fs";
import path from "node:path";
import type { MacroTotals } from "../domain/types";
import exampleDb from "../../../data/nutrition-100g.example.json" with { type: "json" };

export type NutritionItem = {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  foodKind: "single_food" | "dish";
  cookingState: "raw" | "cooked" | "dried" | "processed";
  basisGrams: 100;
  aliases: string[];
  per100g: MacroTotals;
  missingNutrients: Array<keyof MacroTotals>;
  qualityFlags: string[];
  recipeId?: string;
  source: { name: string; method: "reference" | "recipe_calculation"; url: string; fdcId?: number; [key: string]: unknown };
};
export type NutritionDb = {
  version: string; source: string; unit: "per_100g"; basis: "edible_portion"; note?: string; foods: NutritionItem[];
};
export type DbMeta = { version: string; source: string; unit: string; count: number };
export type MatchResult = { item: NutritionItem; score: number; matchType: "exact" | "alias" | "fuzzy"; matchedTerm: string };
const METRICS: Array<keyof MacroTotals> = ["protein", "carbs", "fat", "calories", "fiber"];
let cached: { signature: string; db: NutritionDb; index: Map<string, NutritionItem[]> } | undefined;

export function normalizeFoodText(value: string): string {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[\s，。、！？“”‘’().,;:'"!?]/g, "");
}

/** Reject the old approximate schema, non-100g records and unmarked missing data. */
export function validateNutritionDb(value: unknown): NutritionDb {
  const db = value as NutritionDb;
  if (db?.version !== "2.0.0" || db.unit !== "per_100g" || db.basis !== "edible_portion" || !Array.isArray(db.foods) || !db.foods.length) throw new Error("Invalid nutrition database schema");
  const ids = new Set<string>();
  for (const food of db.foods) {
    if (!food.id || ids.has(food.id) || !food.name || food.basisGrams !== 100 || !Array.isArray(food.aliases) || !Array.isArray(food.missingNutrients) || !Array.isArray(food.qualityFlags) || !["raw", "cooked", "dried", "processed"].includes(food.cookingState) || !["single_food", "dish"].includes(food.foodKind)) throw new Error("Invalid nutrition food record");
    ids.add(food.id);
    if (!food.source || !["reference", "recipe_calculation"].includes(food.source.method)) throw new Error("Missing food provenance");
    if (food.source.method === "reference" && (!Number.isInteger(food.source.fdcId) || !food.source.url)) throw new Error("Missing reference identifier");
    if (food.source.method === "recipe_calculation" && !food.recipeId) throw new Error("Missing recipe identifier");
    for (const metric of METRICS) {
      const n = food.per100g?.[metric];
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > (metric === "calories" ? 950 : 100)) throw new Error("Invalid per-100g nutrient value");
    }
    if (food.missingNutrients.some(metric => !METRICS.includes(metric) || food.per100g[metric] !== 0)) throw new Error("Invalid missing nutrient marker");
  }
  return db;
}

function load() {
  const file = path.join(process.cwd(), "data", "nutrition-100g.json");
  let stat: fs.Stats | undefined;
  try { stat = fs.statSync(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const signature = stat ? `${file}:${stat.mtimeMs}:${stat.size}` : "bundled-v2-example";
  if (cached?.signature === signature) return cached;
  const db = validateNutritionDb(stat ? JSON.parse(fs.readFileSync(file, "utf8")) : exampleDb);
  const index = new Map<string, NutritionItem[]>();
  for (const item of db.foods) {
    for (const term of Array.from(new Set([item.name, item.nameEn ?? "", ...item.aliases].map(normalizeFoodText).filter(Boolean)))) {
      index.set(term, [...(index.get(term) ?? []), item]);
    }
  }
  cached = { signature, db, index };
  return cached;
}
export function getNutritionDb(): NutritionDb { return load().db; }
export function getDbMeta(db: NutritionDb = getNutritionDb()): DbMeta {
  return { version: db.version, source: db.source, unit: db.unit, count: db.foods.length };
}

/** Exact names/aliases only for calculation. Multiple states require clarification. */
export function resolveNutritionFood(query: string): { item?: NutritionItem; candidates: NutritionItem[]; reason?: "not_found" | "ambiguous" | "incomplete_nutrients" } {
  const candidates = load().index.get(normalizeFoodText(query)) ?? [];
  if (!candidates.length) return { candidates, reason: "not_found" };
  if (candidates.length !== 1) return { candidates, reason: "ambiguous" };
  const item = candidates[0];
  if (item.missingNutrients.some(m => m !== "fiber")) return { candidates, reason: "incomplete_nutrients" };
  return { item, candidates };
}

/** Fuzzy results are suggestions, never an automatic numeric answer. */
export function searchNutritionDb(query: string, limit = 5): MatchResult[] {
  const q = normalizeFoodText(query);
  if (!q) return [];
  return load().db.foods.flatMap((item): MatchResult[] => {
    const terms = [item.name, item.nameEn ?? "", ...item.aliases].map(normalizeFoodText).filter(Boolean);
    const exact = terms.find(term => term === q);
    if (exact) return [{ item, score: 100, matchType: normalizeFoodText(item.name) === q ? "exact" : "alias", matchedTerm: exact }];
    const suggestion = q.length >= 2 ? terms.find(term => term.includes(q) || (term.length >= 2 && q.includes(term))) : undefined;
    return suggestion ? [{ item, score: 50, matchType: "fuzzy", matchedTerm: suggestion }] : [];
  }).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id)).slice(0, Math.max(0, limit));
}
export function scalePer100gToGrams(macros: MacroTotals, grams: number): MacroTotals {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 100000) throw new Error("Invalid edible food weight");
  return Object.fromEntries(METRICS.map(metric => [metric, Math.round(macros[metric] * grams / 100 * 1e6) / 1e6])) as MacroTotals;
}

export type WeightedNutritionMatch = { item: NutritionItem; grams: number; text: string; foodText: string; macros: MacroTotals };
export type WeightedNutritionResult = { matches: WeightedNutritionMatch[]; complete: boolean; remainingDescription: string; hasExplicitMass: boolean };
const MASS_PATTERN = /(?:\d+(?:\.\d+)?|\.\d+)\s*(?:千克|公斤|kg\b|克|g\b|grams?\b|kilograms?\b)/gi;
const CLEAN_PREFIX = /^(?:(?:今天|早上|中午|晚上|早餐|午餐|晚餐|我|吃了|吃|喝了|喝|了|大概|约|大约)\s*)+/;
function cleanPart(text: string) { return text.trim().replace(CLEAN_PREFIX, "").trim().replace(/(?:左右|大约|约|。|\.)+$/, "").trim(); }

/** Conservative parsing: exact food + one explicit g/kg amount per segment.
 * Units are edible weight. Never infer bowl/whole bone-in weights or ml density.
 */
export function matchWeightedNutrition(description: string): WeightedNutritionResult {
  const text = description.normalize("NFKC");
  const hasExplicitMass = new RegExp(MASS_PATTERN).test(text);
  // Cross-item exclusions and leftovers can change which grams were consumed.
  if (/其中|留到|剩下|分食|分给|只吃|一半|去掉|减去|不吃|没吃|未吃|带骨|连骨|带壳|连壳/.test(text)) {
    return { matches: [], complete: false, remainingDescription: text, hasExplicitMass };
  }
  const parts = text.split(/[，,、+;；\n]|(?:以及|还有|加上|和)|\band\b/i).map(cleanPart).filter(Boolean);
  const matches: WeightedNutritionMatch[] = [], remaining: string[] = [];
  for (const part of parts) {
    const masses = Array.from(part.matchAll(new RegExp(MASS_PATTERN)));
    if (masses.length !== 1) { remaining.push(part); continue; }
    const mass = masses[0];
    const before = part.slice(0, mass.index).trim(), after = part.slice((mass.index ?? 0) + mass[0].length).trim();
    // Reject embedded amounts/qualifiers, ranges, negative amounts and substitutions.
    if (before && after) { remaining.push(part); continue; }
    const foodText = cleanPart(before || after);
    const numeric = Number(mass[0].match(/\d+(?:\.\d+)?|\.\d+/)?.[0]);
    const grams = numeric * (/千克|公斤|kg|kilogram/i.test(mass[0]) ? 1000 : 1);
    const { item } = resolveNutritionFood(foodText);
    if (!item || !Number.isFinite(grams) || grams <= 0 || grams > 100000) { remaining.push(part); continue; }
    matches.push({ item, grams, text: part, foodText, macros: scalePer100gToGrams(item.per100g, grams) });
  }
  return { matches, complete: matches.length > 0 && remaining.length === 0, remainingDescription: remaining.join("，"), hasExplicitMass };
}
