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

  it("generateWeekPlan({preferSimple: true}) creates 5 entries Mon–Fr, simple recipe first", async () => {
    const today = new Date();
    const entries = await generateWeekPlan(today, { preferSimple: true }, client);

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

  it("generateWeekPlan({preferSimple: false}) orders by name — Monday is alphabetically first", async () => {
    const today = new Date();
    const entries = await generateWeekPlan(today, { preferSimple: false }, client);

    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const monday = sorted[0];
    const mondayRecipe = await client.recipe.findUniqueOrThrow({ where: { id: monday.recipeId } });

    const allRecipes = await client.recipe.findMany({ orderBy: { name: "asc" } });
    expect(mondayRecipe.name).toBe(allRecipes[0].name);
  });
});
