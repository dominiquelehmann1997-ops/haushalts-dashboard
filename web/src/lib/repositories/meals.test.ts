import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { addDays, currentWeekBounds, localDateKey } from "@/lib/dates";

import {
  getDomeShiftsForWeek,
  getDraftMealPlan,
  getWeekMealPlan,
  listRecipes,
  recentRecipeUse,
} from "./meals";

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

  it("getWeekMealPlan returns only active entries (ignores drafts)", async () => {
    const { start } = currentWeekBounds();
    const monday = new Date(start);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const seeded = await client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday, lte: end } },
      orderBy: { date: "asc" },
    });
    await client.mealPlanEntry.create({
      data: { date: seeded.date, recipeId: seeded.recipeId, status: "draft" },
    });

    const plan = await getWeekMealPlan(client);
    expect(plan).toHaveLength(5); // still only the 5 active entries
  });

  it("getDraftMealPlan returns only draft entries with dateISO + recipeId", async () => {
    const { start } = currentWeekBounds();
    const monday = new Date(start);
    const seeded = await client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday } },
      orderBy: { date: "asc" },
    });
    await client.mealPlanEntry.create({
      data: {
        date: seeded.date,
        recipeId: seeded.recipeId,
        status: "draft",
        reason: "emely-allein",
        extraPortion: false,
      },
    });

    const draft = await getDraftMealPlan(client);
    expect(draft).toHaveLength(1);
    expect(draft[0].recipeId).toBe(seeded.recipeId);
    expect(draft[0].reason).toBe("emely-allein");
    expect(typeof draft[0].dateISO).toBe("string");
    expect(draft[0].day).toBe("Mo");
  });

  it("listRecipes returns id+name sorted by name", async () => {
    const recipes = await listRecipes(client);
    const names = recipes.map((r) => r.name);
    expect(names).toEqual([...names].sort());
    expect(recipes[0]).toHaveProperty("id");
    expect(recipes[0]).toHaveProperty("name");
  });
});

describe("listRecipes", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("excludes archived recipes", async () => {
    const before = await listRecipes(client);
    expect(before.length).toBeGreaterThan(0);
    const target = before[0];
    await client.recipe.update({ where: { id: target.id }, data: { archived: true } });

    const after = await listRecipes(client);
    expect(after.find((r) => r.id === target.id)).toBeUndefined();
    expect(after.length).toBe(before.length - 1);
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

describe("recentRecipeUse", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("mappt jedes Rezept auf die Tage seit der jüngsten aktiven Verwendung vor der Referenz", async () => {
    const { start: monday } = currentWeekBounds();
    const recipes = await client.recipe.findMany({ orderBy: { name: "asc" } });

    // zwei Verwendungen desselben Rezepts: die jüngste (vor 3 Tagen) zählt
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -10), recipeId: recipes[0].id, status: "active" },
    });
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -3), recipeId: recipes[0].id, status: "active" },
    });
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -7), recipeId: recipes[1].id, status: "active" },
    });

    const map = await recentRecipeUse(monday, client);
    expect(map.get(recipes[0].id)).toBe(3);
    expect(map.get(recipes[1].id)).toBe(7);
  });

  it("ignoriert Entwürfe, Einträge ab der Referenz und Einträge älter als 21 Tage", async () => {
    const { start: monday } = currentWeekBounds();
    const recipes = await client.recipe.findMany({ orderBy: { name: "asc" } });

    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -5), recipeId: recipes[0].id, status: "draft" },
    });
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -30), recipeId: recipes[1].id, status: "active" },
    });

    const map = await recentRecipeUse(monday, client);
    expect(map.has(recipes[0].id)).toBe(false);
    expect(map.has(recipes[1].id)).toBe(false);
    // die geseedeten aktiven Einträge der Woche liegen AUF/NACH dem Montag → zählen nicht
    expect(map.size).toBe(0);
  });
});
