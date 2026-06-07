// Repository for the weekly meal plan.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Meal } from "@/lib/domain";

// German short weekday labels, indexed by `Date#getDay()` (0 = Sunday).
const WEEKDAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

/** Returns the Monday 00:00 → Sunday 23:59:59.999 bounds of the current local ISO week. */
function currentWeekBounds(): { start: Date; end: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(today);
  monday.setDate(monday.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

/** True if `date` falls on the same local day as "today". */
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * MealPlanEntries of the current ISO week joined to their Recipe, ordered Mon→Fri.
 *
 * NOTE: `light` is intentionally left `undefined` — there is no DB source for
 * it yet (purely a visual/UI detail); a follow-up phase can add a schema field
 * if needed.
 */
export async function getWeekMealPlan(client: PrismaClient = prisma): Promise<Meal[]> {
  const { start, end } = currentWeekBounds();

  const rows = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: { recipe: true },
    orderBy: { date: "asc" },
  });

  return rows.map((row) => ({
    day: WEEKDAY_LABELS[row.date.getDay()],
    dish: row.recipe.name,
    today: isToday(row.date),
  }));
}
