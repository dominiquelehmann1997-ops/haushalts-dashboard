import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { addDays, currentWeekBounds } from "@/lib/dates";

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

  // Mit weightedPick wählt rng→0.999 stets das LETZTE Element des Tages-Pools
  // (Rad-Ende) und rng→0 das ERSTE — beides pinnt die Auswahl deterministisch.
  const identityRng = () => 0.999;
  const zeroRng = () => 0;

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
    const drafts = await client.mealPlanEntry.findMany({
      where: { date: { gte: start, lte: end }, status: "draft" },
    });
    expect(drafts).toHaveLength(5);
  });

  it("generateWeekPlan({preferSimple: false}) mit zero rng wählt für Montag das alphabetisch erste Rezept", async () => {
    const today = new Date();
    const entries = await generateWeekPlan(today, { preferSimple: false }, client, zeroRng);

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

    // identityRng (~1) wählt je Tag das letzte, () => 0 das erste Pool-Element —
    // die beiden Tages-Reihenfolgen müssen sich unterscheiden.
    const identityPlan = await generateWeekPlan(today, { preferSimple: false }, client, identityRng);
    const identityNames = await orderedNames(identityPlan);

    const shuffledPlan = await generateWeekPlan(today, { preferSimple: false }, client, () => 0);
    const shuffledNames = await orderedNames(shuffledPlan);

    expect(shuffledNames).not.toEqual(identityNames);
    // Same set of recipes, just a different order.
    expect([...shuffledNames].sort()).toEqual([...identityNames].sort());
  });

  it("generateWeekPlan writes drafts and leaves seeded active entries intact", async () => {
    const today = new Date();
    await generateWeekPlan(today, { preferSimple: false }, client, identityRng);

    const { start, end } = (await import("@/lib/dates")).currentWeekBounds();
    const active = await client.mealPlanEntry.findMany({
      where: { date: { gte: start, lte: end }, status: "active" },
    });
    const drafts = await client.mealPlanEntry.findMany({
      where: { date: { gte: start, lte: end }, status: "draft" },
    });
    expect(active).toHaveLength(5); // seed plan untouched
    expect(drafts).toHaveLength(5); // freshly generated draft
  });

  it("gewichtet favorit-Rezepte höher (deterministisch über rng)", async () => {
    // Erstes Rezept (alphabetisch) → favorit, Rest → selten: Gewichte [3, .3, .3, .3, .3]
    await client.recipe.updateMany({ data: { rating: "selten" } });
    const all = await client.recipe.findMany({ orderBy: { name: "asc" } });
    await client.recipe.update({ where: { id: all[0].id }, data: { rating: "favorit" } });

    // rng 0.5 → 0.5 · 4.2 = 2.1 < 3 → das favorit-Rezept gewinnt den Montag
    const entries = await generateWeekPlan(new Date(), { preferSimple: false }, client, () => 0.5);
    const monday = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    expect(monday.recipeId).toBe(all[0].id);

    // Gegenprobe: rng 0.95 → 3.99 → fällt ans Rad-Ende → NICHT das favorit-Rezept
    const entries2 = await generateWeekPlan(new Date(), { preferSimple: false }, client, () => 0.95);
    const monday2 = [...entries2].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    expect(monday2.recipeId).not.toBe(all[0].id);
  });

  it("dämpft kürzlich gekochte Rezepte (Recency aus aktiver Historie)", async () => {
    const { start: monday } = currentWeekBounds();
    const all = await client.recipe.findMany({ orderBy: { name: "asc" } });

    // Ohne Historie: alle Gewichte 1, rng 0.1 → 0.5 < 1 → alphabetisch erstes Rezept
    const before = await generateWeekPlan(new Date(), { preferSimple: false }, client, () => 0.1);
    const beforeMonday = [...before].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    expect(beforeMonday.recipeId).toBe(all[0].id);

    // Erstes Rezept vor 2 Tagen aktiv gekocht → Gewicht 0.15 (Floor):
    // Summe 4.15, rng 0.1 → 0.415 > 0.15 → das ZWEITE Rezept gewinnt den Montag
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -2), recipeId: all[0].id, status: "active" },
    });
    const after = await generateWeekPlan(new Date(), { preferSimple: false }, client, () => 0.1);
    const afterMonday = [...after].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    expect(afterMonday.recipeId).toBe(all[1].id);
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
