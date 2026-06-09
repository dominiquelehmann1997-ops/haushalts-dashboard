import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";
import { syncIngredientsToShopping } from "@/lib/services/shoppingSync";

import { getFreshShoppingState } from "./shopping";

describe("getFreshShoppingState", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
    await syncIngredientsToShopping(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("returns the open fresh recipe items and a suggested day before earliest fresh use", async () => {
    const state = await getFreshShoppingState(client);

    expect(state.pendingItems).toContain("Tomaten");
    expect(state.pendingItems).not.toContain("Nudeln"); // haltbar

    const { start } = currentWeekBounds();
    const sunday = new Date(start);
    sunday.setDate(sunday.getDate() - 1);
    expect(state.suggestedDayISO).toBe(sunday.toISOString());
  });

  it("has no pending items once fresh items are pushed", async () => {
    await client.shoppingItem.updateMany({
      where: { source: "recipe", category: "frisch" },
      data: { pushed: true },
    });
    const state = await getFreshShoppingState(client);
    expect(state.pendingItems).toEqual([]);
    expect(state.suggestedDayISO).toBeNull();
  });
});
