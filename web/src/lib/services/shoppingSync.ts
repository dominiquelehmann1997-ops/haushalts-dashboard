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
import { resolveFreshness } from "@/lib/services/freshness";
import { getFreshnessOverrides } from "@/lib/repositories/freshnessOverride";
import { combineAmounts, type AmountPart } from "@/lib/services/ingredientAmount";

/**
 * Reads the current ISO week's meal plan, collects the unique (case-
 * insensitive) ingredient names across all planned recipes, and regenerates
 * the `source: "recipe"` shopping items to match exactly that set. Each item
 * gets a freshness `category` (from `Ingredient.category`, falling back to a
 * learned override, then `classifyFreshness`) and `pushed: false`.
 *
 * Returns the recipe ingredient names it wrote (display casing), so callers
 * can push exactly those to Bring without re-querying — see
 * `approveDraftAction`.
 */
export async function syncIngredientsToShopping(client: PrismaClient = prisma): Promise<string[]> {
  const { start, end } = currentWeekBounds();

  const entries = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end }, status: "active" },
    include: { recipe: { include: { ingredients: true } } },
  });

  const overrides = await getFreshnessOverrides(client);

  // Case-insensitive dedupe, preserving first-seen casing for display and the
  // ingredient's freshness category (falls back to the name heuristic).
  const byKey = new Map<string, { name: string; category: string; amounts: AmountPart[] }>();
  for (const entry of entries) {
    // Übersprungene Tage (recipeId null → recipe null) liefern keine Zutaten.
    for (const ingredient of entry.recipe?.ingredients ?? []) {
      const key = ingredient.name.trim().toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        // Gleiche Zutat in mehreren Rezepten → Mengen sammeln (später summiert).
        existing.amounts.push({ amount: ingredient.amount, unit: ingredient.unit });
      } else {
        byKey.set(key, {
          name: ingredient.name.trim(),
          category: ingredient.category ?? resolveFreshness(ingredient.name, overrides),
          amounts: [{ amount: ingredient.amount, unit: ingredient.unit }],
        });
      }
    }
  }

  await client.shoppingItem.deleteMany({ where: { source: "recipe" } });

  const entriesOut = [...byKey.values()];
  for (const item of entriesOut) {
    await client.shoppingItem.create({
      data: {
        text: item.name,
        meal: true,
        source: "recipe",
        category: item.category,
        spec: combineAmounts(item.amounts),
        pushed: false,
        done: false,
      },
    });
  }

  return entriesOut.map((e) => e.name);
}
