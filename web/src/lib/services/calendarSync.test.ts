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

    expect(result).toEqual({ synced: 1 });
    const events = await getTodaysEvents(new Date(), client);
    expect(events.map((e) => e.title)).toContain("Sport");
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
