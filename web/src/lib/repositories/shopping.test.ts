import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getShoppingItems, setShoppingDone } from "./shopping";

describe("shopping repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getShoppingItems returns all items mapped to the domain DTO", async () => {
    const items = await getShoppingItems(client);

    expect(items).toHaveLength(8);

    const tomaten = items.find((i) => i.text === "Tomaten");
    expect(tomaten?.meal).toBe(true);

    const milch = items.find((i) => i.text === "Milch");
    expect(milch?.done).toBe(true);
  });

  it("setShoppingDone updates the item's done flag", async () => {
    const before = await getShoppingItems(client);
    const item = before.find((i) => i.text === "Brot");
    expect(item?.done).toBe(false);

    await setShoppingDone(item!.id, true, client);

    const after = await getShoppingItems(client);
    expect(after.find((i) => i.id === item!.id)?.done).toBe(true);

    await setShoppingDone(item!.id, false, client);

    const reverted = await getShoppingItems(client);
    expect(reverted.find((i) => i.id === item!.id)?.done).toBe(false);
  });
});
