import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getFreshnessOverrides, toggleItemFreshness } from "./freshnessOverride";

describe("freshnessOverride repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("toggleItemFreshness flippt das Item und upserted den normalisierten Override", async () => {
    const item = await client.shoppingItem.create({
      data: { text: "Kokosmilch", meal: true, source: "recipe", category: "frisch" },
    });

    const next = await toggleItemFreshness(item.id, client);

    expect(next).toBe("haltbar");
    const updated = await client.shoppingItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.category).toBe("haltbar");
    const override = await client.freshnessOverride.findUniqueOrThrow({
      where: { name: "kokosmilch" },
    });
    expect(override.freshness).toBe("haltbar");
  });

  it("ein zweiter Toggle flippt zurück und aktualisiert dieselbe Override-Zeile", async () => {
    const item = await client.shoppingItem.create({
      data: { text: "Kokosmilch", meal: true, source: "recipe", category: "frisch" },
    });

    await toggleItemFreshness(item.id, client);
    const next = await toggleItemFreshness(item.id, client);

    expect(next).toBe("frisch");
    expect(await client.freshnessOverride.count()).toBe(1);
    const override = await client.freshnessOverride.findUniqueOrThrow({
      where: { name: "kokosmilch" },
    });
    expect(override.freshness).toBe("frisch");
  });

  it("ignoriert manuelle Items und Rezept-Items ohne Kategorie", async () => {
    // Seed: "Brot" ist manuell; "Tomaten" ist source "recipe", aber category null.
    const manual = await client.shoppingItem.findFirstOrThrow({ where: { text: "Brot" } });
    const uncategorized = await client.shoppingItem.findFirstOrThrow({
      where: { text: "Tomaten", source: "recipe" },
    });

    expect(await toggleItemFreshness(manual.id, client)).toBeNull();
    expect(await toggleItemFreshness(uncategorized.id, client)).toBeNull();
    expect(await client.freshnessOverride.count()).toBe(0);
  });

  it("getFreshnessOverrides liefert die Name→Frische-Map", async () => {
    await client.freshnessOverride.create({ data: { name: "kokosmilch", freshness: "haltbar" } });
    await client.freshnessOverride.create({ data: { name: "feta", freshness: "frisch" } });

    const map = await getFreshnessOverrides(client);

    expect(map.get("kokosmilch")).toBe("haltbar");
    expect(map.get("feta")).toBe("frisch");
    expect(map.size).toBe(2);
  });
});
