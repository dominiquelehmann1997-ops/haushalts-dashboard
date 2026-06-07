import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getComputedSplit, getWeeklyBalances } from "./accounts";

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
});
