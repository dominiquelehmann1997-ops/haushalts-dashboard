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

  it("aktive Einträge ohne Rezept (übersprungen) liefern keine Zutaten und crashen nicht", async () => {
    const { start } = (await import("@/lib/dates")).currentWeekBounds();
    const recipe = await client.recipe.create({
      data: {
        name: "ZZZ Übersprungen",
        simple: true,
        ingredients: { create: [{ name: "Skip-Zutat-XYZ", amount: null, unit: null }] },
      },
    });
    const entry = await client.mealPlanEntry.create({
      data: { date: new Date(start), recipeId: recipe.id, status: "active" },
    });
    // Tag bewusst überspringen → Rezept entfernen (recipeId null).
    await client.mealPlanEntry.update({ where: { id: entry.id }, data: { recipeId: null } });

    const names = await syncIngredientsToShopping(client);
    expect(names).not.toContain("Skip-Zutat-XYZ");
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

  it("schreibt die zusammengefasste Mengenangabe (spec) und summiert über Rezepte gleicher Einheit", async () => {
    const { start } = (await import("@/lib/dates")).currentWeekBounds();
    // Zwei aktive Rezepte mit derselben Zutat/Einheit an verschiedenen Tagen.
    for (const [offset, gramm] of [[0, "200"], [1, "300"]] as const) {
      const recipe = await client.recipe.create({
        data: {
          name: `ZZZ Mehl-Rezept ${offset}`,
          simple: true,
          ingredients: { create: [{ name: "ZZZ-Mehl", amount: gramm, unit: "g" }] },
        },
      });
      const day = new Date(start);
      day.setDate(day.getDate() + offset);
      await client.mealPlanEntry.create({ data: { date: day, recipeId: recipe.id, status: "active" } });
    }

    await syncIngredientsToShopping(client);

    const mehl = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "ZZZ-Mehl" },
    });
    expect(mehl.spec).toBe("500 g");
  });

  it("setzt spec auf null, wenn die Zutat keine Mengenangabe hat", async () => {
    const { start } = (await import("@/lib/dates")).currentWeekBounds();
    const recipe = await client.recipe.create({
      data: {
        name: "ZZZ Ohne-Menge",
        simple: true,
        ingredients: { create: [{ name: "ZZZ-Olivenöl", amount: null, unit: null }] },
      },
    });
    await client.mealPlanEntry.create({ data: { date: new Date(start), recipeId: recipe.id, status: "active" } });

    await syncIngredientsToShopping(client);

    const oel = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "ZZZ-Olivenöl" },
    });
    expect(oel.spec).toBeNull();
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
