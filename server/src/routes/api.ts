import { Hono } from "hono";
import { db } from "edgespark";
import { auth } from "edgespark/http";
import { and, desc, eq } from "drizzle-orm";
import { foods, userEntries, users } from "@defs";
import { searchFoods } from "../lib/search";

export const api = new Hono<{ Bindings: Env }>();

// Current authenticated user (session issued by EdgeSpark auth).
api.get("/auth/me", async (c) => {
  const profile = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.user.id))
    .get();
  return c.json({ user: profile });
});

api.get("/foods", async (c) => {
  const q = c.req.query("q") ?? "";
  const limit = Number(c.req.query("limit") ?? 8);
  const foodsList = q ? await searchFoods(q, limit) : await db.select().from(foods).limit(limit);
  return c.json({ foods: foodsList });
});

// User food intake entry -> persisted to EdgeSpark D1 (user_entries).
api.post("/entries", async (c) => {
  const body = await c.req.json<{
    name: string;
    grams: number;
    macros: { protein: number; carbs: number; fat: number; calories: number; fiber: number };
    meal: string;
    foodId?: string;
  }>();

  const [entry] = await db
    .insert(userEntries)
    .values({
      id: crypto.randomUUID(),
      userId: auth.user.id,
      foodId: body.foodId,
      name: body.name,
      grams: body.grams,
      macros: body.macros,
      meal: body.meal,
      createdAt: new Date()
    })
    .returning();

  return c.json({ entry }, 201);
});

api.get("/entries", async (c) => {
  const rows = await db
    .select()
    .from(userEntries)
    .where(eq(userEntries.userId, auth.user.id))
    .orderBy(desc(userEntries.createdAt))
    .limit(30);
  return c.json({ entries: rows });
});

// Illustration of table-join over the local database.
api.get("/entries/with-food", async (c) => {
  const rows = await db
    .select({
      id: userEntries.id,
      name: userEntries.name,
      grams: userEntries.grams,
      macros: userEntries.macros,
      foodName: foods.name
    })
    .from(userEntries)
    .innerJoin(foods, eq(userEntries.foodId, foods.id))
    .where(and(eq(userEntries.userId, auth.user.id)))
    .limit(30);
  return c.json({ entries: rows });
});

type Env = Record<string, never>;
