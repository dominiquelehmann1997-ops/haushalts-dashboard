import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { generateWeekPlan } from "./mealPlanner";
import { syncIngredientsToShopping, mergeAmounts } from "./shoppingSync";

const MANUAL_SEED_ITEMS = ["Windeln Gr. 2", "Feuchttücher", "Milch", "Brot", "Spülmittel"];

describe("shoppingSync service", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
    // Establish a known plan before syncing.
    await generateWeekPlan(new Date(), { preferSimple: true }, client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("creates recipe shopping items for the planned recipes' ingredients", async () => {
    await syncIngredientsToShopping(client);

    const items = await client.shoppingItem.findMany({ where: { source: "recipe" } });
    const tomaten = items.find((i) => i.text === "Tomaten");

    expect(tomaten).toBeTruthy();
    expect(tomaten?.meal).toBe(true);
    expect(tomaten?.source).toBe("recipe");
    expect(tomaten?.done).toBe(false);
  });

  it("returns the recipe ingredient names it wrote (for downstream Bring push)", async () => {
    const names = await syncIngredientsToShopping(client);

    const recipeItems = await client.shoppingItem.findMany({ where: { source: "recipe" } });
    const recipeTexts = recipeItems.map((i) => i.text);

    // The returned names match exactly the persisted recipe items (same set).
    expect([...names].sort()).toEqual([...recipeTexts].sort());
    // And ingredients of the planned recipes are present.
    expect(names).toContain("Tomaten");
  });

  it("leaves manual items untouched", async () => {
    await syncIngredientsToShopping(client);

    const manualItems = await client.shoppingItem.findMany({ where: { source: "manual" } });
    const manualTexts = manualItems.map((i) => i.text);

    for (const text of MANUAL_SEED_ITEMS) {
      expect(manualTexts).toContain(text);
    }
  });

  it("running sync twice does not duplicate recipe items (regenerate, not merge)", async () => {
    await syncIngredientsToShopping(client);
    const firstCount = await client.shoppingItem.count({ where: { source: "recipe" } });

    await syncIngredientsToShopping(client);
    const secondCount = await client.shoppingItem.count({ where: { source: "recipe" } });

    expect(secondCount).toBe(firstCount);

    // No duplicate names among recipe items.
    const items = await client.shoppingItem.findMany({ where: { source: "recipe" } });
    const names = items.map((i) => i.text.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("ignores draft meal-plan entries (only active recipes feed the list)", async () => {
    const { start } = (await import("@/lib/dates")).currentWeekBounds();
    const recipe = await client.recipe.create({
      data: {
        name: "ZZZ Draft-Only-Gericht",
        simple: true,
        ingredients: { create: [{ name: "Geheimzutat-XYZ", amount: null, unit: null }] },
      },
    });
    await client.mealPlanEntry.create({
      data: { date: new Date(start), recipeId: recipe.id, status: "draft" },
    });

    const names = await syncIngredientsToShopping(client);
    expect(names).not.toContain("Geheimzutat-XYZ");
  });

  it("tags recipe shopping items with a freshness category and pushed=false", async () => {
    await syncIngredientsToShopping(client);

    const tomaten = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Tomaten" },
    });
    expect(tomaten.category).toBe("frisch");
    expect(tomaten.pushed).toBe(false);

    const nudeln = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Nudeln" },
    });
    expect(nudeln.category).toBe("haltbar");
  });

  it("wendet gelernte Haltbarkeits-Korrekturen an (Override schlägt Heuristik)", async () => {
    await client.freshnessOverride.create({ data: { name: "tomaten", freshness: "haltbar" } });

    await syncIngredientsToShopping(client);

    const tomaten = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Tomaten" },
    });
    expect(tomaten.category).toBe("haltbar");
  });

  it("explizite Angabe (Ingredient.category) schlägt den Override", async () => {
    await client.ingredient.updateMany({ where: { name: "Nudeln" }, data: { category: "frisch" } });
    await client.freshnessOverride.create({ data: { name: "nudeln", freshness: "haltbar" } });

    await syncIngredientsToShopping(client);

    const nudeln = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Nudeln" },
    });
    expect(nudeln.category).toBe("frisch");
  });

  it("Vorrats-Basics (Olivenöl) erscheinen nicht auf dem Einkaufszettel", async () => {
    const names = await syncIngredientsToShopping(client);

    expect(names.map((n) => n.toLowerCase())).not.toContain("olivenöl");
    const olivenöl = await client.shoppingItem.findFirst({
      where: { source: "recipe", text: { contains: "öl" } },
    });
    expect(olivenöl).toBeNull();
  });

  it("gleiche Zutat aus zwei Rezepten wird zusammengerechnet", async () => {
    const { start } = (await import("@/lib/dates")).currentWeekBounds();
    const zweitesTomatenRezept = await client.recipe.create({
      data: {
        name: "Tomatensuppe",
        simple: true,
        ingredients: { create: [{ name: "Tomaten", amount: "4", unit: null }] },
      },
    });
    await client.mealPlanEntry.create({
      data: { date: new Date(start), recipeId: zweitesTomatenRezept.id, status: "active" },
    });

    await syncIngredientsToShopping(client);

    const tomatItems = await client.shoppingItem.findMany({
      where: { source: "recipe", text: "Tomaten" },
    });
    // Nur ein Item (kein Duplikat)
    expect(tomatItems).toHaveLength(1);
    // 6 (aus Pasta al Pomodoro) + 4 = 10
    expect(tomatItems[0].amount).toBe("10");
    expect(tomatItems[0].unit).toBeNull();
  });

  it("Mengen mit verschiedenen Einheiten werden nicht addiert (amount bleibt null)", async () => {
    const { start } = (await import("@/lib/dates")).currentWeekBounds();
    const rezeptMitGramm = await client.recipe.create({
      data: {
        name: "Tomatensoße",
        simple: true,
        ingredients: { create: [{ name: "Tomaten", amount: "500", unit: "g" }] },
      },
    });
    await client.mealPlanEntry.create({
      data: { date: new Date(start), recipeId: rezeptMitGramm.id, status: "active" },
    });

    await syncIngredientsToShopping(client);

    const tomaten = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Tomaten" },
    });
    // unit null (Stück) ≠ "g" → nicht addierbar
    expect(tomaten.amount).toBeNull();
  });

  it("überträgt Menge und Einheit für eindeutige Zutaten", async () => {
    await syncIngredientsToShopping(client);

    const nudeln = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Nudeln" },
    });
    expect(nudeln.amount).toBe("500");
    expect(nudeln.unit).toBe("g");
  });
});

describe("mergeAmounts (unit)", () => {
  it("addiert gleiche Einheiten als Integer", () => {
    expect(mergeAmounts({ amount: "6", unit: null }, { amount: "4", unit: null })).toEqual({
      amount: "10",
      unit: null,
    });
  });

  it("addiert gleiche Einheiten in Gramm", () => {
    expect(mergeAmounts({ amount: "500", unit: "g" }, { amount: "300", unit: "g" })).toEqual({
      amount: "800",
      unit: "g",
    });
  });

  it("gibt null zurück wenn Einheiten verschieden sind", () => {
    expect(mergeAmounts({ amount: "6", unit: null }, { amount: "500", unit: "g" })).toEqual({
      amount: null,
      unit: null,
    });
  });

  it("gibt null zurück wenn eine Menge fehlt", () => {
    expect(mergeAmounts({ amount: null, unit: null }, { amount: "4", unit: null })).toEqual({
      amount: null,
      unit: null,
    });
  });

  it("bewahrt Einheit wenn Menge null", () => {
    expect(mergeAmounts({ amount: null, unit: "g" }, { amount: "4", unit: "g" })).toEqual({
      amount: null,
      unit: "g",
    });
  });

  it("formatiert Dezimalzahlen korrekt", () => {
    expect(mergeAmounts({ amount: "1.5", unit: "EL" }, { amount: "0.5", unit: "EL" })).toEqual({
      amount: "2",
      unit: "EL",
    });
  });
});
