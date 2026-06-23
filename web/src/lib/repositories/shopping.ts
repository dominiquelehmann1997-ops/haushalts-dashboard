// Repository for the shared shopping list.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { ShoppingItem, FreshShoppingState } from "@/lib/domain";
import { currentWeekBounds } from "@/lib/dates";
import { resolveFreshness, suggestFreshShoppingDay } from "@/lib/services/freshness";
import { getFreshnessOverrides } from "@/lib/repositories/freshnessOverride";

/** All shopping items, not-done first then by creation order, mapped to the domain DTO. */
export async function getShoppingItems(client: PrismaClient = prisma): Promise<ShoppingItem[]> {
  const rows = await client.shoppingItem.findMany({
    orderBy: [{ done: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    meal: row.meal,
    done: row.done,
    category:
      row.source === "recipe" && (row.category === "frisch" || row.category === "haltbar")
        ? row.category
        : null,
    spec: row.spec ?? null,
  }));
}

/** Updates a shopping item's `done` flag. */
export async function setShoppingDone(
  id: string,
  done: boolean,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.shoppingItem.update({ where: { id }, data: { done } });
}

/** Removes a single shopping item by id. */
export async function deleteShoppingItem(
  id: string,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.shoppingItem.delete({ where: { id } });
}

/** Clears the whole shopping list. */
export async function clearShoppingItems(client: PrismaClient = prisma): Promise<void> {
  await client.shoppingItem.deleteMany();
}

/**
 * Frische-Einkaufs-Zustand fürs Dashboard: die offenen, noch nicht gepushten
 * Frisch-Rezept-Items plus ein Vorschlagstag (Tag vor dem frühesten Verbrauch
 * einer Frisch-Zutat im aktiven Wochenplan).
 */
export async function getFreshShoppingState(
  client: PrismaClient = prisma,
): Promise<FreshShoppingState> {
  const pendingRows = await client.shoppingItem.findMany({
    where: { source: "recipe", category: "frisch", pushed: false, done: false },
    orderBy: { createdAt: "asc" },
  });
  const pendingItems = pendingRows.map((r) => r.text);

  // No pending fresh items → no suggestion (keeps the DTO internally consistent
  // and skips the plan scan).
  if (pendingItems.length === 0) {
    return { pendingItems, suggestedDayISO: null };
  }

  const { start, end } = currentWeekBounds();
  const entries = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end }, status: "active" },
    include: { recipe: { include: { ingredients: true } } },
    orderBy: { date: "asc" },
  });

  const overrides = await getFreshnessOverrides(client);

  let earliest: Date | null = null;
  for (const entry of entries) {
    // Übersprungene Tage (recipeId null → recipe null) liefern keine Zutaten.
    const hasFresh = (entry.recipe?.ingredients ?? []).some(
      (i) => (i.category ?? resolveFreshness(i.name, overrides)) === "frisch",
    );
    if (hasFresh) {
      earliest = entry.date;
      break; // entries are ordered by date asc
    }
  }

  const suggested = suggestFreshShoppingDay(earliest);
  return { pendingItems, suggestedDayISO: suggested ? suggested.toISOString() : null };
}
