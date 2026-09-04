import { relations } from "drizzle-orm";
import { foods, userEntries, users } from "./db_schema";

export const usersRelations = relations(users, ({ many }) => ({
  entries: many(userEntries)
}));

export const foodsRelations = relations(foods, ({ many }) => ({
  entries: many(userEntries)
}));

export const userEntriesRelations = relations(userEntries, ({ one }) => ({
  user: one(users, { fields: [userEntries.userId], references: [users.id] }),
  food: one(foods, { fields: [userEntries.foodId], references: [foods.id] })
}));
