import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getShoppingItems } from "./shopping";

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
});
