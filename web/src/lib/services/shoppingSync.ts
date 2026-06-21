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
import { isPantryBasic } from "@/lib/services/pantryBasics";

type AmountUnit = { amount: string | null; unit: string | null };

/**
 * Addiert zwei Mengenangaben, wenn sie die gleiche Einheit haben.
 * Schlägt die Addition fehl (verschiedene Einheiten, nicht-numerisch, ein Wert
 * null), wird `{ amount: null, unit: null }` zurückgegeben.
 */
export function mergeAmounts(prev: AmountUnit, next: AmountUnit): AmountUnit {
  if (!prev.amount || !next.amount) return { amount: null, unit: prev.unit ?? next.unit };
  if (prev.unit !== next.unit) return { amount: null, unit: null };
  const a = parseFloat(prev.amount);
  const b = parseFloat(next.amount);
  if (isNaN(a) || isNaN(b)) return { amount: null, unit: prev.unit };
  const sum = a + b;
  const formatted =
    Number.isInteger(a) && Number.isInteger(b) ? String(sum) : sum.toFixed(1).replace(/\.0$/, "");
  return { amount: formatted, unit: prev.unit };
}

/**
 * Reads the current ISO week's meal plan, collects the unique (case-
 * insensitive) ingredient names across all planned recipes, and regenerates
 * the `source: "recipe"` shopping items to match exactly that set. Each item
 * gets a freshness `category` (from `Ingredient.category`, falling back to a
 * learned override, then `classifyFreshness`) and `pushed: false`.
 *
 * Vorrats-Basics (Öl, Salz, Pfeffer, Standardgewürze) werden übersprungen.
 * Gleiche Zutaten aus mehreren Rezepten werden zusammengefasst — Mengen
 * werden addiert, sofern die Einheit übereinstimmt.
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

  type Accumulated = { name: string; category: string; amount: string | null; unit: string | null };

  // Case-insensitive dedupe with amount accumulation. Preserves first-seen
  // casing for display. Pantry basics (Öl, Salz, Pfeffer, …) are skipped.
  const byKey = new Map<string, Accumulated>();
  for (const entry of entries) {
    for (const ingredient of entry.recipe.ingredients) {
      const key = ingredient.name.trim().toLowerCase();
      if (isPantryBasic(key)) continue;
      if (!byKey.has(key)) {
        byKey.set(key, {
          name: ingredient.name.trim(),
          category: ingredient.category ?? resolveFreshness(ingredient.name, overrides),
          amount: ingredient.amount ?? null,
          unit: ingredient.unit ?? null,
        });
      } else {
        const prev = byKey.get(key)!;
        const merged = mergeAmounts(prev, { amount: ingredient.amount ?? null, unit: ingredient.unit ?? null });
        byKey.set(key, { ...prev, ...merged });
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
        amount: item.amount,
        unit: item.unit,
        pushed: false,
        done: false,
      },
    });
  }

  return entriesOut.map((e) => e.name);
}
