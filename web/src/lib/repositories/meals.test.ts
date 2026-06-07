import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getWeekMealPlan } from "./meals";

describe("meals repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getWeekMealPlan returns the current week's plan Mon→Fr, mapped to the domain DTO", async () => {
    const plan = await getWeekMealPlan(client);

    expect(plan).toHaveLength(5);

    const monday = plan.find((m) => m.day === "Mo");
    expect(monday?.dish).toBe("Pasta al Pomodoro");

    // The seed only plants Mon–Fri entries (anchored to the current ISO week).
    // On a Mon–Fri run, exactly the entry for "today" should be flagged; on a
    // weekend run, none of the (weekday-only) entries can match "today".
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    const todays = plan.filter((m) => m.today);
    expect(todays).toHaveLength(isWeekday ? 1 : 0);
  });
});
