import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";
import type { BringItem, BringPushResult } from "@/integrations/bring/client";

import { pushMealIngredients } from "./mealIngredientPush";

describe("pushMealIngredients", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  /** Records what was pushed; reports success. */
  function fakePush() {
    const calls: BringItem[][] = [];
    const push = async (items: BringItem[]): Promise<BringPushResult> => {
      calls.push(items);
      return { ok: true, pushed: items.length };
    };
    return { calls, push };
  }

  async function mondayEntry() {
    const { start } = currentWeekBounds();
    const monday = new Date(start);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday, lte: end }, status: "active" },
      include: { recipe: { include: { ingredients: true } } },
      orderBy: { date: "asc" },
    });
  }

  it("pushes exactly the day's recipe ingredients and marks the entry pushed", async () => {
    const entry = await mondayEntry(); // seed: Montag = Pasta al Pomodoro
    const { calls, push } = fakePush();

    const res = await pushMealIngredients(entry.id, client, push);

    expect(res.bring.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const names = calls[0].map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(["Nudeln", "Tomaten", "Basilikum", "Parmesan"]));
    expect(res.items.sort()).toEqual(names.sort());

    const updated = await client.mealPlanEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(updated.ingredientsPushedAt).not.toBeNull();
  });

  it("passes each ingredient's amount as spec", async () => {
    const entry = await mondayEntry();
    const { calls, push } = fakePush();
    await pushMealIngredients(entry.id, client, push);

    const nudeln = calls[0].find((i) => i.name === "Nudeln");
    expect(nudeln?.spec).toBe("500 g");
  });

  it("combines duplicate ingredient names within the same recipe", async () => {
    const recipe = await client.recipe.create({
      data: {
        name: "ZZZ Doppel-Zutat",
        simple: true,
        ingredients: {
          create: [
            { name: "Mehl", amount: "200", unit: "g" },
            { name: "mehl", amount: "300", unit: "g" }, // same ingredient, different casing
          ],
        },
      },
    });
    const { start } = currentWeekBounds();
    const entry = await client.mealPlanEntry.create({
      data: { date: new Date(start), recipeId: recipe.id, status: "active" },
    });

    const { calls, push } = fakePush();
    await pushMealIngredients(entry.id, client, push);

    expect(calls[0]).toHaveLength(1);
    expect(calls[0][0]).toEqual({ name: "Mehl", spec: "500 g" });
  });

  it("does not mark the entry pushed when the push fails", async () => {
    const entry = await mondayEntry();
    const failingPush = async (): Promise<BringPushResult> => ({ ok: false, error: "boom" });

    const res = await pushMealIngredients(entry.id, client, failingPush);

    expect(res.bring.ok).toBe(false);
    const updated = await client.mealPlanEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(updated.ingredientsPushedAt).toBeNull();
  });

  it("is a no-op success for a skipped day (no recipe)", async () => {
    const { start } = currentWeekBounds();
    const entry = await client.mealPlanEntry.create({
      data: { date: new Date(start), recipeId: null, status: "active" },
    });
    const { calls, push } = fakePush();

    const res = await pushMealIngredients(entry.id, client, push);

    expect(res).toEqual({ bring: { ok: true, pushed: 0 }, items: [] });
    expect(calls).toHaveLength(0);
  });

  it("is a no-op success for a recipe without ingredients", async () => {
    // seed: "Reste" (Mittwoch) has no ingredients.
    const { start } = currentWeekBounds();
    const wednesday = new Date(start);
    wednesday.setDate(wednesday.getDate() + 2);
    const end = new Date(wednesday);
    end.setHours(23, 59, 59, 999);
    const entry = await client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: wednesday, lte: end }, status: "active" },
    });
    const { calls, push } = fakePush();

    const res = await pushMealIngredients(entry.id, client, push);

    expect(res).toEqual({ bring: { ok: true, pushed: 0 }, items: [] });
    expect(calls).toHaveLength(0);
  });
});
