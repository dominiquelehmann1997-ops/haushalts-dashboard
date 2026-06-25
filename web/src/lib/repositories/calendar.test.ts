import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { dayBounds } from "@/lib/dates";

import { getBusyWindows, getTodaysEvents, replaceWindowEvents, upsertEvents } from "./calendar";

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

  describe("replaceWindowEvents", () => {
    const at = (h: number, m: number, dayOffset = 0) => {
      const d = new Date(today);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const makeInput = (externalId: string, title: string, start: Date, end: Date) => ({
      externalId,
      calendarKey: "dome",
      title,
      start,
      end,
      personKey: "dome" as const,
      kind: "termin" as const,
      place: null,
    });

    it("upserts the snapshot and deletes window events no longer present", async () => {
      const window = { from: at(0, 0), to: at(0, 0, 14) };

      // First snapshot: two events.
      await replaceWindowEvents(
        [
          makeInput("dome:keep", "Sport", at(18, 0), at(19, 0)),
          makeInput("dome:gone", "AZT", at(9, 0), at(10, 0)),
        ],
        window,
        client,
      );

      // Second snapshot drops "AZT" — it must be pruned.
      const { deleted } = await replaceWindowEvents(
        [makeInput("dome:keep", "Sport", at(18, 0), at(19, 0))],
        window,
        client,
      );

      expect(deleted).toBe(1);
      expect(await client.calendarEvent.findUnique({ where: { externalId: "dome:gone" } })).toBeNull();
      expect(await client.calendarEvent.findUnique({ where: { externalId: "dome:keep" } })).not.toBeNull();
    });

    it("leaves events outside the window untouched", async () => {
      // Seed an event well outside the sync window, directly.
      await client.calendarEvent.create({
        data: makeInput("dome:far", "Weit weg", at(8, 0, 30), at(9, 0, 30)),
      });

      const window = { from: at(0, 0), to: at(0, 0, 14) };
      await replaceWindowEvents([makeInput("dome:keep", "Sport", at(18, 0), at(19, 0))], window, client);

      expect(await client.calendarEvent.findUnique({ where: { externalId: "dome:far" } })).not.toBeNull();
    });
  });

  describe("getBusyWindows", () => {
    it("returns dome's and emely's seeded events as busy windows for the right persons", async () => {
      const { start, end } = dayBounds(today);

      const windows = await getBusyWindows(start, end, client);

      const emelyWindows = windows.filter((w) => w.person === "emely");
      const domeWindows = windows.filter((w) => w.person === "dome");

      expect(emelyWindows).toContainEqual(
        expect.objectContaining({
          person: "emely",
          start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0),
          end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
        }),
      );
      expect(domeWindows).toContainEqual(
        expect.objectContaining({
          person: "dome",
          start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 30),
          end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0),
        }),
      );
    });

    it("turns the family calendar's personless events (e.g. 'Paket abholen') into a busy window for both dome and emely", async () => {
      const { start, end } = dayBounds(today);

      const windows = await getBusyWindows(start, end, client);
      const paketWindows = windows.filter(
        (w) =>
          w.start.getTime() ===
          new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0).getTime(),
      );

      expect(paketWindows.map((w) => w.person).sort()).toEqual(["dome", "emely"]);
    });

    it("excludes baby events from busy windows", async () => {
      const { start, end } = dayBounds(today);

      const windows = await getBusyWindows(start, end, client);

      expect(windows.some((w) => (w as { person: string }).person === "baby")).toBe(false);
      expect(windows).toHaveLength(4);
    });

    describe("overnight shifts (Nacht/LN)", () => {
      const dayAt = (base: Date, dayOffset: number, hours: number, minutes: number) => {
        const d = new Date(base);
        d.setDate(d.getDate() + dayOffset);
        d.setHours(hours, minutes, 0, 0);
        return d;
      };

      async function addShift(title: string, startDayOffset: number) {
        await client.calendarEvent.create({
          data: {
            externalId: `shift-${title}-${startDayOffset}`,
            calendarKey: "dome",
            title,
            start: dayAt(today, startDayOffset, 21, 0),
            end: dayAt(today, startDayOffset, 23, 59),
            personKey: "dome",
            kind: "termin",
            place: null,
          },
        });
      }

      it("extends a 'Nacht' shift's busy window to 14:00 the next day", async () => {
        await addShift("Nacht", 0);
        const { start, end } = dayBounds(today);

        const windows = await getBusyWindows(start, end, client);

        expect(windows).toContainEqual({
          person: "dome",
          start: dayAt(today, 0, 21, 0),
          end: dayAt(today, 1, 14, 0),
        });
      });

      it("treats 'LN' identically to 'Nacht'", async () => {
        await addShift("LN", 0);
        const { start, end } = dayBounds(today);

        const windows = await getBusyWindows(start, end, client);

        expect(windows).toContainEqual({
          person: "dome",
          start: dayAt(today, 0, 21, 0),
          end: dayAt(today, 1, 14, 0),
        });
      });

      it("surfaces a previous-day overnight shift as a busy window reaching into the requested day", async () => {
        await addShift("Nacht", -1); // shift started yesterday, runs into today
        const { start, end } = dayBounds(today);

        const windows = await getBusyWindows(start, end, client);

        expect(windows).toContainEqual({
          person: "dome",
          start: dayAt(today, -1, 21, 0),
          end: dayAt(today, 0, 14, 0),
        });
      });

      it("does not surface an unrelated previous-day event for the requested day", async () => {
        await client.calendarEvent.create({
          data: {
            externalId: "yesterday-zahnarzt",
            calendarKey: "dome",
            title: "Zahnarzt",
            start: dayAt(today, -1, 10, 0),
            end: dayAt(today, -1, 11, 0),
            personKey: "dome",
            kind: "termin",
            place: null,
          },
        });
        const { start, end } = dayBounds(today);

        const windows = await getBusyWindows(start, end, client);

        expect(windows.some((w) => w.start.getTime() === dayAt(today, -1, 10, 0).getTime())).toBe(
          false,
        );
      });
    });
  });
});
