// Meal-plan generator — picks recipes from the curated recipe book for Mon–Fr
// of the week containing `weekStart`, respecting per-day shift constraints
// (simple / reheatable requirements, extra-portion flag, reason label) derived
// from Dome's shift schedule.

import { addDays, mondayOf } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { MealPlanEntry, Recipe } from "@/generated/prisma/client";
import type { DayConstraint } from "@/lib/services/mealConstraints";

export interface GenerateWeekPlanOptions {
  /** When `true`, recipes flagged `simple` are preferred on unconstrained days. */
  preferSimple: boolean;
  /**
   * Per-weekday (Mon–Fri) cooking constraints derived from Dome's shifts.
   * When omitted, every day is treated as unconstrained (no reason / no extra).
   */
  constraints?: DayConstraint[];
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
  const start = mondayOf(date);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** A constraint with no requirements, for days/weeks without shift data. */
function noConstraint(date: Date): DayConstraint {
  return {
    date,
    needsSimple: false,
    needsReheatable: false,
    extraPortion: false,
    reason: null,
  };
}

/**
 * Ordered candidate pool for one day, derived from the (already shuffled, and
 * for `preferSimple` simple-first) `base` list. Filters by the day's
 * constraints with the conflict priority from the spec; falls back to `base`
 * whenever a filtered pool would be empty so a recipe can always be chosen.
 */
export function candidatesFor(
  c: DayConstraint,
  base: Recipe[],
  preferSimple: boolean,
): Recipe[] {
  let pool: Recipe[];
  if (c.needsSimple && c.needsReheatable) {
    const both = base.filter((r) => r.simple && r.reheatable);
    pool = both.length > 0 ? both : base.filter((r) => r.simple); // simple has priority
  } else if (c.needsSimple) {
    pool = base.filter((r) => r.simple);
  } else if (c.needsReheatable) {
    pool = base.filter((r) => r.reheatable);
  } else {
    pool = preferSimple ? base.filter((r) => r.simple) : base;
  }
  return pool.length > 0 ? pool : base;
}

/**
 * Generates (and persists) the Mon–Fr meal plan for the week containing
 * `weekStart` **as a draft** (`status: "draft"`), replacing any existing draft
 * entries for that week. The active plan and shopping list are untouched —
 * promotion to active happens via `approveDraft`.
 *
 * For each weekday the recipe is chosen from a candidate pool that satisfies
 * that day's shift constraints (`opts.constraints`, Mon–Fri; defaults to
 * unconstrained). `preferSimple` biases unconstrained days toward simple
 * recipes. Within the pool, the first not-yet-used recipe wins (variety);
 * `rng` shuffles the base order so re-generating yields a fresh plan — and
 * keeps tests deterministic when injected. Each entry persists the day's
 * `reason` and `extraPortion` marker.
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

  // Freshness: shuffle once; for preferSimple, stable-sort simple recipes first.
  let base = shuffle(recipes, rng);
  if (opts.preferSimple) {
    base = [...base].sort((a, b) => (a.simple === b.simple ? 0 : a.simple ? -1 : 1));
  }

  const weekdayDates = [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
  const constraints = weekdayDates.map(
    (date, i) => opts.constraints?.[i] ?? noConstraint(date),
  );

  // Replace: wipe only the draft entries for this week, then (re-)create 5 draft entries.
  await client.mealPlanEntry.deleteMany({
    where: { date: { gte: monday, lte: sunday }, status: "draft" },
  });

  const used = new Set<string>();
  const created: MealPlanEntry[] = [];
  for (let i = 0; i < weekdayDates.length; i++) {
    const c = constraints[i];
    const pool = candidatesFor(c, base, opts.preferSimple);
    const fresh = pool.filter((r) => !used.has(r.id));
    const pick = (fresh.length > 0 ? fresh : pool)[0];
    used.add(pick.id);

    const entry = await client.mealPlanEntry.create({
      data: {
        date: weekdayDates[i],
        recipeId: pick.id,
        reason: c.reason,
        extraPortion: c.extraPortion,
        status: "draft",
      },
    });
    created.push(entry);
  }

  return created;
}
