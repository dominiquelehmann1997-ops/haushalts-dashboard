import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";
import { generateWeekPlan } from "./mealPlanner";

import { approveDraft, discardDraft } from "./mealDraft";

describe("mealDraft lifecycle", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  async function weekCounts() {
    const { start, end } = currentWeekBounds();
    const active = await client.mealPlanEntry.count({
      where: { date: { gte: start, lte: end }, status: "active" },
    });
    const draft = await client.mealPlanEntry.count({
      where: { date: { gte: start, lte: end }, status: "draft" },
    });
    return { active, draft };
  }

  it("approveDraft replaces the active plan with the draft and clears the draft", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    expect(await weekCounts()).toEqual({ active: 5, draft: 5 });

    const ok = await approveDraft(new Date(), client);
    expect(ok).toBe(true);
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 });
  });

  it("approveDraft is a no-op (false) when there is no draft", async () => {
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 }); // seed only
    const ok = await approveDraft(new Date(), client);
    expect(ok).toBe(false);
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 });
  });

  it("discardDraft removes only the draft, leaving the active plan", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    await discardDraft(new Date(), client);
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 });
  });
});
