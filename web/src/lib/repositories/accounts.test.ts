import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { addManualEntry, getComputedSplit, getWeeklyBalances } from "./accounts";

describe("accounts repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getWeeklyBalances sums AccountEntry points per person for the current ISO week", async () => {
    const balances = await getWeeklyBalances(client);
    expect(balances).toEqual({ dome: 60, emely: 40 });
  });

  it("getComputedSplit returns integer percentages derived from the weekly balances", async () => {
    const split = await getComputedSplit(client);
    expect(split).toEqual({ dome: 60, emely: 40 });
  });

  it("addManualEntry creates a 'betreuung' entry for emely that shifts the weekly balances/split", async () => {
    const before = await getWeeklyBalances(client);

    const created = await addManualEntry(
      { personKey: "emely", label: "Spontane Betreuung", points: 20, source: "betreuung" },
      client,
    );

    expect(created.points).toBe(20);
    expect(created.source).toBe("betreuung");
    expect(created.label).toBe("Spontane Betreuung");

    const after = await getWeeklyBalances(client);
    expect(after).toEqual({ dome: before.dome, emely: before.emely + 20 });

    const split = await getComputedSplit(client);
    expect(split.emely).toBeGreaterThan(40);
  });
});
