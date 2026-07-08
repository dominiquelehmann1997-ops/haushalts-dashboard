import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { clearShoppingItems, deleteShoppingItem, getShoppingItems } from "./shopping";

describe("getShoppingItems", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("liefert die manuell gepflegten Felder inkl. Mengenangabe (spec)", async () => {
    await client.shoppingItem.create({
      data: { text: "Mehl", meal: false, source: "manual", spec: "500 g" },
    });

    const items = await getShoppingItems(client);
    const mehl = items.find((i) => i.text === "Mehl");
    const brot = items.find((i) => i.text === "Brot"); // seed, ohne Menge

    expect(mehl?.spec).toBe("500 g");
    expect(brot?.spec).toBeNull();
  });
});

describe("deleteShoppingItem", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("entfernt genau ein Item, lässt den Rest stehen", async () => {
    const before = await getShoppingItems(client);
    const tomaten = before.find((i) => i.text === "Tomaten")!;

    await deleteShoppingItem(tomaten.id, client);

    const after = await getShoppingItems(client);
    expect(after.find((i) => i.id === tomaten.id)).toBeUndefined();
    expect(after).toHaveLength(before.length - 1);
  });
});

describe("clearShoppingItems", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("leert die gesamte Einkaufsliste", async () => {
    expect((await getShoppingItems(client)).length).toBeGreaterThan(0);

    await clearShoppingItems(client);

    expect(await getShoppingItems(client)).toEqual([]);
  });
});
