import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { BringItem, BringPushResult } from "@/integrations/bring/client";

import { syncIngredientsToShopping } from "./shoppingSync";
import { pushRecipeBatch } from "./shoppingBatch";

describe("pushRecipeBatch", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
    await syncIngredientsToShopping(client); // recipe items with categories
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

  it("pushes only the given category's recipe items and marks them pushed", async () => {
    const { calls, push } = fakePush();
    const res = await pushRecipeBatch("haltbar", client, push);

    expect(res.bring.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const haltbar = await client.shoppingItem.findMany({
      where: { source: "recipe", category: "haltbar" },
    });
    expect(haltbar.every((i) => i.pushed)).toBe(true);
    const frisch = await client.shoppingItem.findMany({
      where: { source: "recipe", category: "frisch" },
    });
    expect(frisch.every((i) => !i.pushed)).toBe(true);
  });

  it("passes each item's quantity (spec) through to the push", async () => {
    const { calls, push } = fakePush();
    await pushRecipeBatch("haltbar", client, push);

    const rows = await client.shoppingItem.findMany({
      where: { source: "recipe", category: "haltbar" },
    });
    const specByName = new Map(rows.map((r) => [r.text, r.spec]));
    const pushed = calls[0];

    for (const item of pushed) {
      expect(item.spec ?? null).toBe(specByName.get(item.name) ?? null);
    }
    // At least one planned haltbar ingredient carries a real quantity.
    expect(pushed.some((i) => typeof i.spec === "string" && i.spec.length > 0)).toBe(true);
  });

  it("does not mark items pushed when the push fails", async () => {
    const failingPush = async (): Promise<BringPushResult> => ({ ok: false, error: "boom" });
    const res = await pushRecipeBatch("haltbar", client, failingPush);

    expect(res.bring.ok).toBe(false);
    const haltbar = await client.shoppingItem.findMany({
      where: { source: "recipe", category: "haltbar" },
    });
    expect(haltbar.every((i) => !i.pushed)).toBe(true);
  });

  it("a second push of the same category pushes nothing (all already pushed)", async () => {
    const { push } = fakePush();
    await pushRecipeBatch("haltbar", client, push);
    const second = await pushRecipeBatch("haltbar", client, push);
    expect(second.items).toEqual([]);
    expect(second.bring).toEqual({ ok: true, pushed: 0 });
  });
});
