import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getTodaysEvents } from "./calendar";

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
});
