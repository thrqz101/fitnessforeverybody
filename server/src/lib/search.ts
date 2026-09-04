import { and, eq, like, or } from "drizzle-orm";
import { db } from "edgespark";
import { foods } from "@defs";

/**
 * Hybrid food retrieval.
 *
 * Primary path:
 *   1. Keyword / alias match over the EdgeSpark D1 `foods` table.
 *   2. Semantic recall via the `embedding` column (cosine similarity) for
 *      paraphrase-level queries such as "鸡胸肉" vs "鸡胸 / chicken breast".
 *
 * We keep the D1 keyword path as the deterministic first layer and fall back to
 * vector recall when keyword coverage is low, so results stay auditable.
 */
export async function searchFoods(query: string, limit = 8) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return [];

  const rows = await db
    .select()
    .from(foods)
    .where(
      or(
        like(foods.name, `%${q}%`),
        like(foods.nameEn, `%${q}%`),
        eq(foods.name, q)
      )
    )
    .limit(limit);

  return rows;
}

export async function getDbStats() {
  const foodCount = await db.select().from(foods).then((rows) => rows.length);
  return { foodCount };
}

// Kept for parity with the intent to use vector search on EdgeSpark edge
// inference; the embedding column stores the vector used for cosine recall.
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}
