import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { generateWeekPlan } from "./mealPlanner";

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
