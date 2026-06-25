import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { getTodaysEvents } from "@/lib/repositories/calendar";
import { syncCalendar } from "./calendarSync";

describe("calendarSync service", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("fetches each configured calendar and upserts the events", async () => {
    const now = new Date();
    const fetch = async (_id: string, calendarKey: string) => [
      {
        externalId: `${calendarKey}:e1`,
        calendarKey,
        title: "Sport",
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0),
        personKey: "dome" as const,
        kind: "termin" as const,
        place: null,
      },
    ];

    const result = await syncCalendar([{ calendarId: "cid", calendarKey: "dome" }], { fetch, client });

    expect(result.synced).toBe(1);
    const events = await getTodaysEvents(new Date(), client);
    expect(events.map((e) => e.title)).toContain("Sport");
  });

  it("prunes events that disappeared upstream (deleted in Google Calendar)", async () => {
    const now = new Date();
    const event = (id: string, title: string) => ({
      externalId: `dome:${id}`,
      calendarKey: "dome",
      title,
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0),
      personKey: "dome" as const,
      kind: "termin" as const,
      place: null,
    });

    // First sync brings in two events.
    const firstFetch = async () => [event("e1", "Sport"), event("e2", "AZT")];
    await syncCalendar([{ calendarId: "cid", calendarKey: "dome" }], { fetch: firstFetch, client });
    expect((await getTodaysEvents(new Date(), client)).map((e) => e.title)).toEqual(
      expect.arrayContaining(["Sport", "AZT"]),
    );

    // "AZT" is deleted upstream → the next fetch no longer returns it.
    const secondFetch = async () => [event("e1", "Sport")];
    const result = await syncCalendar([{ calendarId: "cid", calendarKey: "dome" }], { fetch: secondFetch, client });

    expect(result).toEqual({ synced: 1, deleted: 1 });
    const titles = (await getTodaysEvents(new Date(), client)).map((e) => e.title);
    expect(titles).toContain("Sport");
    expect(titles).not.toContain("AZT");
  });

  it("clears the window when the calendar comes back empty", async () => {
    const now = new Date();
    const seedFetch = async () => [
      {
        externalId: "dome:e1",
        calendarKey: "dome",
        title: "AZT",
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0),
        personKey: "dome" as const,
        kind: "termin" as const,
        place: null,
      },
    ];
    await syncCalendar([{ calendarId: "cid", calendarKey: "dome" }], { fetch: seedFetch, client });

    const emptyFetch = async () => [];
    const result = await syncCalendar([{ calendarId: "cid", calendarKey: "dome" }], { fetch: emptyFetch, client });

    expect(result).toEqual({ synced: 0, deleted: 1 });
    expect(await getTodaysEvents(new Date(), client)).toHaveLength(0);
  });

  it("propagates a fetch error (e.g. not connected)", async () => {
    const fetch = async () => {
      throw new Error("not connected");
    };
    await expect(
      syncCalendar([{ calendarId: "cid", calendarKey: "dome" }], { fetch, client }),
    ).rejects.toThrow("not connected");
  });
});
