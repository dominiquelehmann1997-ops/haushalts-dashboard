// Meal-plan generator — picks recipes from the curated recipe book for Mon–Sun
// of the week containing `weekStart`, respecting per-day shift constraints
// (simple / reheatable requirements, extra-portion flag, reason label) derived
// from Dome's shift schedule.
// Innerhalb des erlaubten Pools wählt ein gewichtetes Roulette-Rad
// (Rating favorit/ok/selten + Recency-Dämpfung, s. mealWeights.ts).

import { addDays, weekBoundsOf } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { MealPlanEntry, Recipe } from "@/generated/prisma/client";
import type { DayConstraint } from "@/lib/services/mealConstraints";
import { weightedPick, varietyFactor, parseTags } from "./mealWeights";
import { recentRecipeUse } from "@/lib/repositories/meals";

export interface GenerateWeekPlanOptions {
  /** When `true`, recipes flagged `simple` are preferred on unconstrained days. */
  preferSimple: boolean;
  /**
   * Per-weekday (Mon–Sun) cooking constraints derived from Dome's shifts.
   * When omitted, every day is treated as unconstrained (no reason / no extra).
   */
  constraints?: DayConstraint[];
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
 * Ordered candidate pool for one day, derived from the `base` recipe list.
 * Filters by the day's constraints with the conflict priority from the spec
 * (incl. the `preferSimple` bias on unconstrained days); falls back to `base`
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
 * Generates (and persists) the Mon–Sun meal plan for the week containing
 * `weekStart` **as a draft** (`status: "draft"`), replacing any existing draft
 * entries for that week. The active plan and shopping list are untouched —
 * promotion to active happens via `approveDraft`.
 *
 * For each weekday the recipe is chosen from a candidate pool that satisfies
 * that day's shift constraints (`opts.constraints`, Mon–Sun; defaults to
 * unconstrained). `preferSimple` biases unconstrained days toward simple
 * recipes. Within the pool, a weighted roulette pick chooses the recipe: rating weights
 * (favorit 3× / ok 1× / selten 0.3×) times a recency damping for dishes cooked
 * in the last ~14 days (active history, see `recentRecipeUse`). Not-yet-used
 * recipes are preferred for variety. `rng` drives the wheel — injecting it
 * keeps tests deterministic. Each entry persists the day's
 * `reason` and `extraPortion` marker.
 */
export async function generateWeekPlan(
  weekStart: Date,
  opts: GenerateWeekPlanOptions,
  client: PrismaClient = prisma,
  rng: () => number = Math.random,
): Promise<MealPlanEntry[]> {
  const { start: monday, end: sunday } = weekBoundsOf(weekStart);

  const recipes = await client.recipe.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  if (recipes.length === 0) return [];

  // Recency-Dämpfung: was in den 21 Tagen VOR dieser Woche aktiv gekocht wurde.
  const recent = await recentRecipeUse(monday, client);

  const weekdayDates = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(monday, offset));
  const constraints = weekdayDates.map(
    (date, i) => opts.constraints?.[i] ?? noConstraint(date),
  );

  // Replace: wipe only the draft entries for this week, then (re-)create 7 draft entries.
  await client.mealPlanEntry.deleteMany({
    where: { date: { gte: monday, lte: sunday }, status: "draft" },
  });

  const used = new Set<string>();
  // Vielfalt über die Woche: zählt, wie oft jeder Tag schon gewählt wurde, und
  // dämpft Rezepte mit denselben Tags an den Folgetagen (kein 3× Pasta).
  const usedTagCounts = new Map<string, number>();
  const created: MealPlanEntry[] = [];
  for (let i = 0; i < weekdayDates.length; i++) {
    const c = constraints[i];
    const pool = candidatesFor(c, recipes, opts.preferSimple);
    const fresh = pool.filter((r) => !used.has(r.id));
    // Pool ist nie leer (recipes.length > 0 + base-Fallback in candidatesFor) → `!` sicher.
    const choices = fresh.length > 0 ? fresh : pool;
    const varietyFactors = new Map(
      choices.map((r) => [r.id, varietyFactor(parseTags(r.tags), usedTagCounts)] as const),
    );
    const pick = weightedPick(choices, recent, rng, varietyFactors)!;
    used.add(pick.id);
    for (const tag of parseTags(pick.tags)) {
      usedTagCounts.set(tag, (usedTagCounts.get(tag) ?? 0) + 1);
    }

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
