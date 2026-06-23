// Repository for the weekly meal plan.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Meal, DraftMeal, RecipeOption } from "@/lib/domain";
import { addDays, currentWeekBounds, localDateKey, mondayOf } from "@/lib/dates";
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
 * MealPlanEntries of the current ISO week joined to their Recipe, ordered Mon→Sun.
 *
 * NOTE: `light` is intentionally left `undefined` — there is no DB source for
 * it yet (purely a visual/UI detail); a follow-up phase can add a schema field
 * if needed.
 */
export async function getWeekMealPlan(client: PrismaClient = prisma): Promise<Meal[]> {
  const { start, end } = currentWeekBounds();

  const rows = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end }, status: "active" },
    include: { recipe: true },
    orderBy: { date: "asc" },
  });

  return rows.map((row) => ({
    day: WEEKDAY_LABELS[row.date.getDay()],
    dish: row.recipe?.name ?? "frei", // recipeId null → Tag bewusst übersprungen
    today: isToday(row.date),
    reason: row.reason,
    extraPortion: row.extraPortion,
  }));
}

/**
 * Wie `getWeekMealPlan`, aber nur die Entwurfs-Einträge (`status:"draft"`) der
 * aktuellen Woche — inkl. `dateISO` und `recipeId`, damit die Entwurfs-Ansicht
 * einzelne Tage neu würfeln oder das Rezept tauschen kann.
 */
export async function getDraftMealPlan(client: PrismaClient = prisma): Promise<DraftMeal[]> {
  const { start, end } = currentWeekBounds();

  const rows = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end }, status: "draft" },
    include: { recipe: true },
    orderBy: { date: "asc" },
  });

  return rows.map((row) => ({
    dateISO: row.date.toISOString(),
    day: WEEKDAY_LABELS[row.date.getDay()],
    dish: row.recipe?.name ?? "frei", // recipeId null → Tag bewusst übersprungen
    recipeId: row.recipeId,
    reason: row.reason,
    extraPortion: row.extraPortion,
  }));
}

/** Alle Rezepte als `{ id, name }`, nach Name sortiert — fürs Tausch-Picker. */
export async function listRecipes(client: PrismaClient = prisma): Promise<RecipeOption[]> {
  const recipes = await client.recipe.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  return recipes.map((r) => ({ id: r.id, name: r.name }));
}

/**
 * Dome's shift class per local day for Mon–Sun of the week containing
 * `weekStart`, keyed by `localDateKey`. The next Monday is included as a
 * lookahead so "day before Spätdienst" can be detected for Sunday. Only
 * `personKey: "dome"` events whose title classifies to a `ShiftClass` are kept.
 */
export async function getDomeShiftsForWeek(
  weekStart: Date,
  client: PrismaClient = prisma,
): Promise<Map<string, ShiftClass>> {
  const monday = mondayOf(weekStart);
  // Mon–Sun + next Monday: the following Monday is included as a lookahead so
  // "day before Spätdienst" can be detected for Sunday.
  const lookaheadEnd = new Date(monday);
  lookaheadEnd.setDate(lookaheadEnd.getDate() + 7);
  lookaheadEnd.setHours(23, 59, 59, 999);

  const rows = await client.calendarEvent.findMany({
    where: { personKey: "dome", start: { gte: monday, lte: lookaheadEnd } },
    orderBy: { start: "asc" },
  });

  // Rows are ordered by start ascending; first classifiable event per day wins
  // so calendar noise (a corrected/duplicate entry) can't silently flip a shift.
  const map = new Map<string, ShiftClass>();
  for (const row of rows) {
    const key = localDateKey(row.start);
    if (map.has(key)) continue;
    const shift = classifyShift(row.title);
    if (shift) map.set(key, shift);
  }
  return map;
}

/**
 * Tage seit der letzten AKTIVEN Verwendung je Rezept, gemessen an `reference`
 * (exklusiv) über die letzten `windowDays` Tage — Grundlage der Recency-
 * Dämpfung der Essensplan-Gewichtung (Feature A). Entwürfe zählen nicht;
 * fehlt ein Rezept in der Map, wurde es im Fenster nicht gekocht.
 */
export async function recentRecipeUse(
  reference: Date,
  client: PrismaClient = prisma,
  windowDays = 21,
): Promise<Map<string, number>> {
  const from = addDays(reference, -windowDays);
  const rows = await client.mealPlanEntry.findMany({
    where: { status: "active", date: { gte: from, lt: reference } },
    orderBy: { date: "desc" },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.recipeId === null) continue; // übersprungene Tage ("frei") zählen nicht
    if (map.has(row.recipeId)) continue; // desc sortiert → jüngste Verwendung gewinnt
    // round statt floor: robust gegen DST-bedingte 23/25-Stunden-Tage
    map.set(row.recipeId, Math.round((reference.getTime() - row.date.getTime()) / 86_400_000));
  }
  return map;
}
