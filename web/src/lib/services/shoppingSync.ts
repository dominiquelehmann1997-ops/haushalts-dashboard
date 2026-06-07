// Shopping-list sync (Phase 6, stage 1) — derives the "recipe" portion of the
// shared shopping list from the current week's meal plan: collects the unique
// ingredient names across all planned recipes and (re-)writes the
// `source: "recipe"` shopping items accordingly.
//
// Regenerate, not merge: existing `source: "recipe"` items are wiped and
// recreated on every sync — this keeps the recipe-derived portion in lockstep
// with the current plan (no stale leftovers from a replaced plan) and is
// trivially idempotent. `source: "manual"` items are never touched.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";

/**
 * Reads the current ISO week's meal plan, collects the unique (case-
 * insensitive) ingredient names across all planned recipes, and regenerates
 * the `source: "recipe"` shopping items to match exactly that set.
 */
export async function syncIngredientsToShopping(client: PrismaClient = prisma): Promise<void> {
  const { start, end } = currentWeekBounds();

  const entries = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: { recipe: { include: { ingredients: true } } },
  });

  // Case-insensitive dedupe, preserving first-seen casing for display.
  const byKey = new Map<string, string>();
  for (const entry of entries) {
    for (const ingredient of entry.recipe.ingredients) {
      const key = ingredient.name.trim().toLowerCase();
      if (!byKey.has(key)) byKey.set(key, ingredient.name.trim());
    }
  }

  await client.shoppingItem.deleteMany({ where: { source: "recipe" } });

  for (const name of byKey.values()) {
    await client.shoppingItem.create({
      data: { text: name, meal: true, source: "recipe", done: false },
    });
  }
}
