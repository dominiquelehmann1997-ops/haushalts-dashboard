// Meal-plan generator (Phase 6, stage 1) — picks recipes from the curated
// recipe book for Mon–Fr of the week containing `weekStart` and (re-)writes
// the `MealPlanEntry` rows for that week.
//
// Stage 1 is intentionally simple: no variety/repetition heuristics beyond a
// deterministic ordering — just "pick the first 5 recipes by the configured
// order, cycling if the book has fewer than 5".

import { addDays } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { MealPlanEntry } from "@/generated/prisma/client";

export interface GenerateWeekPlanOptions {
  /** When `true`, recipes flagged `simple` are ordered first (then by name). */
  preferSimple: boolean;
}

/**
 * Returns a shuffled copy of `items` using a Fisher–Yates shuffle driven by
 * `rng` (a `() => number` in `[0, 1)`, like `Math.random`). Pure — does not
 * mutate the input. Injecting `rng` keeps the shuffle deterministic in tests.
 */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Returns the Monday 00:00 → Sunday 23:59:59.999 bounds of the local ISO week containing `date`. */
function weekBoundsOf(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const dayOfWeek = start.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + diffToMonday);

  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Generates (and persists) the Mon–Fr meal plan for the week containing
 * `weekStart`, replacing any existing entries for that week.
 *
 * Selection: with `preferSimple`, recipes flagged `simple` sort first (then by
 * name); otherwise purely by name. The first 5 recipes are taken, cycling
 * deterministically through the ordered list if the book has fewer than 5.
 *
 * The selected recipes are then assigned to the weekdays in a *shuffled* order
 * (Fisher–Yates via `rng`, default `Math.random`) so re-generating produces a
 * fresh plan — injecting `rng` keeps it deterministic in tests.
 */
export async function generateWeekPlan(
  weekStart: Date,
  opts: GenerateWeekPlanOptions,
  client: PrismaClient = prisma,
  rng: () => number = Math.random,
): Promise<MealPlanEntry[]> {
  const { start: monday, end: sunday } = weekBoundsOf(weekStart);

  const recipes = await client.recipe.findMany({ orderBy: { name: "asc" } });
  if (recipes.length === 0) return [];

  const ordered = opts.preferSimple
    ? [...recipes].sort((a, b) => {
        if (a.simple !== b.simple) return a.simple ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    : recipes;

  const weekdayDates = [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));

  const selected = shuffle(
    weekdayDates.map((_, index) => ordered[index % ordered.length]),
    rng,
  );

  // Replace: wipe this week's plan, then (re-)create the 5 entries.
  await client.mealPlanEntry.deleteMany({ where: { date: { gte: monday, lte: sunday } } });

  const created: MealPlanEntry[] = [];
  for (let i = 0; i < weekdayDates.length; i++) {
    const entry = await client.mealPlanEntry.create({
      data: { date: weekdayDates[i], recipeId: selected[i].id },
    });
    created.push(entry);
  }

  return created;
}
