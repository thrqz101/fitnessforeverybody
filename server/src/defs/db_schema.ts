import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type ServerMacroTotals = {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  fiber: number;
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  // JSON profile: height / weight / gender / bmr / goal / training / eating pattern.
  profile: text("profile", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

export const foods = sqliteTable("foods", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  category: text("category"),
  aliases: text("aliases", { mode: "json" }).$type<string[]>(),
  // Per-100g nutrition, industry average when a dish/meal.
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  calories: real("calories").notNull(),
  fiber: real("fiber").notNull(),
  // Optional vector index for semantic recall (hybrid retrieval).
  embedding: text("embedding", { mode: "json" }).$type<number[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

export const userEntries = sqliteTable("user_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  foodId: text("food_id").references(() => foods.id),
  name: text("name").notNull(),
  grams: real("grams").notNull(),
  macros: text("macros", { mode: "json" }).$type<ServerMacroTotals>(),
  meal: text("meal").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});
