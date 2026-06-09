import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";

import { generateWeekPlan } from "./mealPlanner";
import type { DayConstraint } from "./mealConstraints";

describe("mealPlanner service", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  /** Returns the entries' recipe names ordered Monday→Friday. */
  async function orderedNames(entries: { date: Date; recipeId: string }[]): Promise<string[]> {
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const names: string[] = [];
    for (const entry of sorted) {
      const recipe = await client.recipe.findUniqueOrThrow({ where: { id: entry.recipeId } });
      names.push(recipe.name);
    }
    return names;
  }

  // An rng returning ~1 makes Fisher–Yates a no-op (each i swaps with itself),
  // so the day-assignment keeps the selection-pool order — used to pin the
  // otherwise-shuffled output deterministically in assertions.
  const identityRng = () => 0.999;

  it("generateWeekPlan({preferSimple: true}) creates 5 entries Mon–Fr, simple recipe first (identity rng)", async () => {
    const today = new Date();
    const entries = await generateWeekPlan(today, { preferSimple: true }, client, identityRng);

    expect(entries).toHaveLength(5);

    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const weekdays = sorted.map((e) => e.date.getDay());
    // Monday=1 .. Friday=5
    expect(weekdays).toEqual([1, 2, 3, 4, 5]);

    const monday = sorted[0];
    const mondayRecipe = await client.recipe.findUniqueOrThrow({ where: { id: monday.recipeId } });
    expect(mondayRecipe.simple).toBe(true);
  });

  it("re-running generateWeekPlan replaces the existing plan (still 5, not 10)", async () => {
    const today = new Date();
    await generateWeekPlan(today, { preferSimple: true }, client);
    const second = await generateWeekPlan(today, { preferSimple: true }, client);

    expect(second).toHaveLength(5);

    const { start, end } = (await import("@/lib/dates")).currentWeekBounds();
    const all = await client.mealPlanEntry.findMany({ where: { date: { gte: start, lte: end } } });
    expect(all).toHaveLength(5);
  });

  it("generateWeekPlan({preferSimple: false}) with identity rng orders by name — Monday is alphabetically first", async () => {
    const today = new Date();
    const entries = await generateWeekPlan(today, { preferSimple: false }, client, identityRng);

    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const monday = sorted[0];
    const mondayRecipe = await client.recipe.findUniqueOrThrow({ where: { id: monday.recipeId } });

    const allRecipes = await client.recipe.findMany({ orderBy: { name: "asc" } });
    expect(mondayRecipe.name).toBe(allRecipes[0].name);
  });

  it("assigns each recipe exactly once across the week (full coverage with 5 recipes)", async () => {
    const today = new Date();
    const entries = await generateWeekPlan(today, { preferSimple: false }, client);

    const names = await orderedNames(entries);
    expect(new Set(names).size).toBe(5);
  });

  it("varies the day→recipe assignment with the injected rng", async () => {
    const today = new Date();

    // identityRng keeps selection-pool (alphabetical) order; an rng returning 0
    // permutes it — the two day orders must differ.
    const identityPlan = await generateWeekPlan(today, { preferSimple: false }, client, identityRng);
    const identityNames = await orderedNames(identityPlan);

    const shuffledPlan = await generateWeekPlan(today, { preferSimple: false }, client, () => 0);
    const shuffledNames = await orderedNames(shuffledPlan);

    expect(shuffledNames).not.toEqual(identityNames);
    // Same set of recipes, just a different order.
    expect([...shuffledNames].sort()).toEqual([...identityNames].sort());
  });
});

describe("generateWeekPlan — dienstbewusst", () => {
  let cclient: PrismaClient;

  beforeEach(async () => {
    cclient ??= createTestClient();
    await resetDatabase(cclient);
  });

  afterAll(async () => {
    await cclient?.$disconnect();
  });

  /** Builds a 5-day (Mon–Fri) constraint array for the current week. */
  function constraintsForWeek(
    overrides: Partial<Record<0 | 1 | 2 | 3 | 4, Partial<DayConstraint>>>,
  ): DayConstraint[] {
    const { start } = currentWeekBounds();
    return [0, 1, 2, 3, 4].map((offset) => {
      const date = new Date(start);
      date.setDate(date.getDate() + offset);
      return {
        date,
        needsSimple: false,
        needsReheatable: false,
        extraPortion: false,
        reason: null,
        ...overrides[offset as 0 | 1 | 2 | 3 | 4],
      };
    });
  }

  const identityRng = () => 0.999;

  it("a needsSimple day gets a simple recipe and persists reason/extraPortion", async () => {
    const constraints = constraintsForWeek({
      0: { needsSimple: true, reason: "emely-allein" },
    });
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false, constraints },
      cclient,
      identityRng,
    );
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const monday = sorted[0];
    const recipe = await cclient.recipe.findUniqueOrThrow({ where: { id: monday.recipeId } });
    expect(recipe.simple).toBe(true);
    expect(monday.reason).toBe("emely-allein");
    expect(monday.extraPortion).toBe(false);
  });

  it("a needsReheatable day gets a reheatable recipe and extraPortion=true", async () => {
    const constraints = constraintsForWeek({
      1: { needsReheatable: true, extraPortion: true, reason: "aufwaermen-extra" },
    });
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false, constraints },
      cclient,
      identityRng,
    );
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const tuesday = sorted[1];
    const recipe = await cclient.recipe.findUniqueOrThrow({ where: { id: tuesday.recipeId } });
    expect(recipe.reheatable).toBe(true);
    expect(tuesday.extraPortion).toBe(true);
    expect(tuesday.reason).toBe("aufwaermen-extra");
  });

  it("conflict day (needsSimple+needsReheatable) prefers a recipe that is both (Reste)", async () => {
    const constraints = constraintsForWeek({
      2: {
        needsSimple: true,
        needsReheatable: true,
        extraPortion: true,
        reason: "emely-allein",
      },
    });
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false, constraints },
      cclient,
      identityRng,
    );
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const wed = sorted[2];
    const recipe = await cclient.recipe.findUniqueOrThrow({ where: { id: wed.recipeId } });
    expect(recipe.simple && recipe.reheatable).toBe(true);
    expect(recipe.name).toBe("Reste");
  });

  it("without constraints behaves like before: 5 entries, all reason null", async () => {
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false },
      cclient,
      identityRng,
    );
    expect(entries).toHaveLength(5);
    expect(entries.every((e) => e.reason === null && !e.extraPortion)).toBe(true);
  });

  it("falls back to the full book when no recipe satisfies the constraint", async () => {
    // Remove every reheatable recipe so a needsReheatable day has an empty pool.
    await cclient.recipe.updateMany({ data: { reheatable: false } });

    const constraints = constraintsForWeek({
      0: { needsReheatable: true, extraPortion: true, reason: "aufwaermen-extra" },
    });
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false, constraints },
      cclient,
      identityRng,
    );

    expect(entries).toHaveLength(5);
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const monday = sorted[0];
    // A recipe is still chosen (from the fallback base list) and the marker persists.
    expect(monday.recipeId).toBeTruthy();
    expect(monday.reason).toBe("aufwaermen-extra");
    expect(monday.extraPortion).toBe(true);
    const recipe = await cclient.recipe.findUniqueOrThrow({ where: { id: monday.recipeId } });
    expect(recipe.reheatable).toBe(false); // proves the empty-pool → base fallback fired
  });
});
