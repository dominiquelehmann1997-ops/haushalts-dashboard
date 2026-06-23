import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";
import { generateWeekPlan } from "./mealPlanner";

import { approveDraft, discardDraft, rerollDraftDay, setDraftDayRecipe } from "./mealDraft";

describe("mealDraft lifecycle", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  async function weekCounts() {
    const { start, end } = currentWeekBounds();
    const active = await client.mealPlanEntry.count({
      where: { date: { gte: start, lte: end }, status: "active" },
    });
    const draft = await client.mealPlanEntry.count({
      where: { date: { gte: start, lte: end }, status: "draft" },
    });
    return { active, draft };
  }

  it("approveDraft replaces the active plan with the draft and clears the draft", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    // Seed seeds 5 active (Mon–Fri); der Entwurf deckt jetzt Mo–So (7) ab.
    expect(await weekCounts()).toEqual({ active: 5, draft: 7 });

    const ok = await approveDraft(new Date(), client);
    expect(ok).toBe(true);
    // Abnicken ersetzt die aktive Woche komplett durch den 7-Tage-Entwurf.
    expect(await weekCounts()).toEqual({ active: 7, draft: 0 });
  });

  it("approveDraft is a no-op (false) when there is no draft", async () => {
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 }); // seed only
    const ok = await approveDraft(new Date(), client);
    expect(ok).toBe(false);
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 });
  });

  it("discardDraft removes only the draft, leaving the active plan", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    await discardDraft(new Date(), client);
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 });
  });
});

describe("mealDraft editing", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  // rng=0 → erstes Element; reroll soll bei mehreren Kandidaten ein ANDERES
  // Rezept als das aktuelle wählen.
  const zeroRng = () => 0;

  async function draftMondayEntry() {
    const { start } = currentWeekBounds();
    const monday = new Date(start);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday, lte: end }, status: "draft" },
      include: { recipe: true },
      orderBy: { date: "asc" },
    });
  }

  it("rerollDraftDay swaps to a different recipe and keeps reason/extraPortion", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const before = await draftMondayEntry();
    const allRecipes = await client.recipe.findMany();
    expect(allRecipes.length).toBeGreaterThan(1); // prereq: a different recipe must exist

    const updated = await rerollDraftDay(before.date, false, client, zeroRng);
    expect(updated).not.toBeNull();
    expect(updated!.recipeId).not.toBe(before.recipeId); // changed
    expect(updated!.reason).toBe(before.reason); // unchanged
    expect(updated!.extraPortion).toBe(before.extraPortion); // unchanged
    expect(updated!.status).toBe("draft");
  });

  it("rerollDraftDay on a needsSimple day still picks a simple recipe", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const monday = await draftMondayEntry();
    await client.mealPlanEntry.update({
      where: { id: monday.id },
      data: { reason: "emely-allein", extraPortion: false },
    });

    const updated = await rerollDraftDay(monday.date, false, client, zeroRng);
    const recipe = await client.recipe.findUniqueOrThrow({ where: { id: updated!.recipeId! } });
    expect(recipe.simple).toBe(true);
  });

  it("rerollDraftDay würfelt gewichtet (favorit gewinnt die Rad-Mitte)", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const monday = await draftMondayEntry();

    // Das aktuelle Montags-Rezept ist ausgeschlossen; unter den übrigen vier
    // (alphabetisch) wird das zweite favorit, der Rest selten:
    // Gewichte [0.3, 3, 0.3, 0.3] → Summe 3.9; rng 0.6 → 2.34 → kumulativ
    // [0.3, 3.3, …] → favorit gewinnt. (Alter Zufalls-Index hätte
    // choices[Math.floor(0.6·4)] = choices[2] gewählt — der Test
    // unterscheidet also wirklich alten und neuen Mechanismus.)
    const others = await client.recipe.findMany({
      where: { id: { not: monday.recipeId! } },
      orderBy: { name: "asc" },
    });
    await client.recipe.updateMany({ data: { rating: "selten" } });
    await client.recipe.update({ where: { id: others[1].id }, data: { rating: "favorit" } });

    const updated = await rerollDraftDay(monday.date, false, client, () => 0.6);
    expect(updated!.recipeId).toBe(others[1].id);
  });

  it("setDraftDayRecipe sets exactly the chosen recipe on the draft entry", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const monday = await draftMondayEntry();
    const pizza = await client.recipe.findFirstOrThrow({ where: { name: "Pizzaabend" } });

    const updated = await setDraftDayRecipe(monday.date, pizza.id, client);
    expect(updated!.recipeId).toBe(pizza.id);
    expect(updated!.status).toBe("draft");
  });

  it("setDraftDayRecipe mit leerem Wert überspringt den Tag (recipeId null, kein Crash)", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const monday = await draftMondayEntry();

    const updated = await setDraftDayRecipe(monday.date, "", client);
    expect(updated!.recipeId).toBeNull();
    expect(updated!.status).toBe("draft");
  });

  it("editing functions return null when there is no draft entry for the day", async () => {
    const { start } = currentWeekBounds();
    expect(await setDraftDayRecipe(new Date(start), "whatever", client)).toBeNull();
    expect(await rerollDraftDay(new Date(start), false, client, zeroRng)).toBeNull();
  });
});
