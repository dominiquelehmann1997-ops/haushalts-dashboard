import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { currentWeekBounds, localDateKey } from "@/lib/dates";

import { getDomeShiftsForWeek, getWeekMealPlan } from "./meals";

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

  it("getWeekMealPlan surfaces reason/extraPortion from the entry", async () => {
    const { start } = currentWeekBounds();
    const monday = new Date(start);

    const entry = await client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday } },
      orderBy: { date: "asc" },
    });
    await client.mealPlanEntry.update({
      where: { id: entry.id },
      data: { reason: "emely-allein", extraPortion: true },
    });

    const plan = await getWeekMealPlan(client);
    const mondayMeal = plan.find((m) => m.day === "Mo");
    expect(mondayMeal?.reason).toBe("emely-allein");
    expect(mondayMeal?.extraPortion).toBe(true);
  });
});

describe("getDomeShiftsForWeek", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  /** Creates a dome calendar event on `date` with `title`. */
  async function domeEvent(date: Date, title: string) {
    const start = new Date(date);
    start.setHours(21, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 0, 0);
    await client.calendarEvent.create({
      data: {
        externalId: `shift-${title}-${date.getTime()}`,
        calendarKey: "dome",
        title,
        start,
        end,
        personKey: "dome",
        kind: "termin",
      },
    });
  }

  it("classifies Dome's Mon–Sat shifts into a date→class map", async () => {
    const { start: monday } = currentWeekBounds();
    const tue = new Date(monday);
    tue.setDate(tue.getDate() + 1);
    const sat = new Date(monday);
    sat.setDate(sat.getDate() + 5);

    await domeEvent(tue, "Spät");
    await domeEvent(sat, "Nacht");

    const map = await getDomeShiftsForWeek(monday, client);

    expect(map.get(localDateKey(tue))).toBe("spaet");
    expect(map.get(localDateKey(sat))).toBe("nacht"); // Samstag-Lookahead enthalten
  });

  it("ignores non-shift titles and other persons", async () => {
    const { start: monday } = currentWeekBounds();
    const wed = new Date(monday);
    wed.setDate(wed.getDate() + 2);
    const thu = new Date(monday);
    thu.setDate(thu.getDate() + 3);

    await domeEvent(wed, "Sport"); // dome, but not a shift title

    // An emely shift-titled event must be ignored (only dome is queried).
    const thuStart = new Date(thu);
    thuStart.setHours(21, 0, 0, 0);
    const thuEnd = new Date(thu);
    thuEnd.setHours(23, 59, 0, 0);
    await client.calendarEvent.create({
      data: {
        externalId: `emely-spaet-${thu.getTime()}`,
        calendarKey: "emely",
        title: "Spät",
        start: thuStart,
        end: thuEnd,
        personKey: "emely",
        kind: "termin",
      },
    });

    const map = await getDomeShiftsForWeek(monday, client);
    expect(map.get(localDateKey(wed))).toBeUndefined();
    expect(map.get(localDateKey(thu))).toBeUndefined();
  });

  it("keeps the earliest classifiable shift when a day has two (first-wins)", async () => {
    const { start: monday } = currentWeekBounds();
    const tue = new Date(monday);
    tue.setDate(tue.getDate() + 1);

    // Earlier event (06:00) = Früh; later event (21:00, via helper) = Spät.
    const earlyStart = new Date(tue);
    earlyStart.setHours(6, 0, 0, 0);
    const earlyEnd = new Date(tue);
    earlyEnd.setHours(14, 0, 0, 0);
    await client.calendarEvent.create({
      data: {
        externalId: `dome-frueh-${tue.getTime()}`,
        calendarKey: "dome",
        title: "Früh",
        start: earlyStart,
        end: earlyEnd,
        personKey: "dome",
        kind: "termin",
      },
    });
    await domeEvent(tue, "Spät"); // later start (21:00)

    const map = await getDomeShiftsForWeek(monday, client);
    expect(map.get(localDateKey(tue))).toBe("frueh"); // earliest wins
  });
});
