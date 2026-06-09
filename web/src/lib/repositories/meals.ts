// Repository for the weekly meal plan.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Meal } from "@/lib/domain";
import { currentWeekBounds, localDateKey, mondayOf } from "@/lib/dates";
import { classifyShift, type ShiftClass } from "@/lib/calendar/shifts";

// German short weekday labels, indexed by `Date#getDay()` (0 = Sunday).
const WEEKDAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

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

/**
 * Dome's shift class per local day for Mon–Sat of the week containing
 * `weekStart`, keyed by `localDateKey`. Saturday is included as a lookahead so
 * "day before Spätdienst" can be detected for Friday. Only `personKey: "dome"`
 * events whose title classifies to a `ShiftClass` are kept.
 */
export async function getDomeShiftsForWeek(
  weekStart: Date,
  client: PrismaClient = prisma,
): Promise<Map<string, ShiftClass>> {
  const monday = mondayOf(weekStart);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6); // upper bound; Mon–Sat covered

  const rows = await client.calendarEvent.findMany({
    where: { personKey: "dome", start: { gte: monday, lt: sunday } },
    orderBy: { start: "asc" },
  });

  const map = new Map<string, ShiftClass>();
  for (const row of rows) {
    const shift = classifyShift(row.title);
    if (shift) map.set(localDateKey(row.start), shift);
  }
  return map;
}
