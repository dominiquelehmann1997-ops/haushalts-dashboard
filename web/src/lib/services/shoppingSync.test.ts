import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { generateWeekPlan } from "./mealPlanner";
import { syncIngredientsToShopping } from "./shoppingSync";

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
});
