// Repository for the shared shopping list.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { ShoppingItem, FreshShoppingState } from "@/lib/domain";
import { currentWeekBounds } from "@/lib/dates";
import { classifyFreshness, suggestFreshShoppingDay } from "@/lib/services/freshness";

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

  let earliest: Date | null = null;
  for (const entry of entries) {
    const hasFresh = entry.recipe.ingredients.some(
      (i) => (i.category ?? classifyFreshness(i.name)) === "frisch",
    );
    if (hasFresh) {
      earliest = entry.date;
      break; // entries are ordered by date asc
    }
  }

  const suggested = suggestFreshShoppingDay(earliest);
  return { pendingItems, suggestedDayISO: suggested ? suggested.toISOString() : null };
}
