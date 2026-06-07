import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { dayBounds } from "@/lib/dates";

import { getBusyWindows, getTodaysEvents, upsertEvents } from "./calendar";

describe("calendar repository", () => {
  let client: PrismaClient;
  const today = new Date();

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getTodaysEvents returns today's events ordered by start time, mapped to the domain shape", async () => {
    const events = await getTodaysEvents(today, client);

    expect(events.map((e) => e.time)).toEqual(["11:00", "18:30", "20:00"]);

    const [u4, sport, paket] = events;
    expect(u4.who).toEqual(["emely", "baby"]);
    expect(sport.who).toEqual(["dome"]);
    expect(paket.who).toEqual([]);
  });

  describe("upsertEvents", () => {
    function makeInput(overrides: Partial<Parameters<typeof upsertEvents>[0][number]> = {}) {
      return {
        externalId: "dome:evt-001",
        calendarKey: "dome",
        title: "Sport",
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 30),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0),
        personKey: "dome" as const,
        kind: "termin" as const,
        place: "Verein",
        ...overrides,
      };
    }

    it("creates a new CalendarEvent row for an unseen externalId", async () => {
      await upsertEvents([makeInput()], client);

      const row = await client.calendarEvent.findUnique({ where: { externalId: "dome:evt-001" } });
      expect(row).toMatchObject({ title: "Sport", calendarKey: "dome", personKey: "dome", place: "Verein" });
    });

    it("upserting twice doesn't duplicate and updates fields", async () => {
      await upsertEvents([makeInput()], client);
      await upsertEvents([makeInput({ title: "Sport (verschoben)", place: "Halle 2" })], client);

      const rows = await client.calendarEvent.findMany({ where: { externalId: "dome:evt-001" } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ title: "Sport (verschoben)", place: "Halle 2" });
    });
  });

  describe("getBusyWindows", () => {
    it("returns dome's and emely's seeded events as busy windows for the right persons", async () => {
      const { start, end } = dayBounds(today);

      const windows = await getBusyWindows(start, end, client);

      expect(windows).toHaveLength(2);

      const emely = windows.find((w) => w.person === "emely");
      const dome = windows.find((w) => w.person === "dome");

      expect(emely).toMatchObject({
        person: "emely",
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
      });
      expect(dome).toMatchObject({
        person: "dome",
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 30),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0),
      });
    });

    it("excludes events without a dome/emely personKey (e.g. the family 'Paket abholen' event)", async () => {
      const { start, end } = dayBounds(today);

      const windows = await getBusyWindows(start, end, client);

      expect(windows.some((w) => (w as { person: string }).person === "baby")).toBe(false);
      expect(windows).toHaveLength(2);
    });
  });
});
