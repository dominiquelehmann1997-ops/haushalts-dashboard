import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getActiveProjectProgress } from "./projects";

describe("projects repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getActiveProjectProgress summarizes the project's subtask progress", async () => {
    const progress = await getActiveProjectProgress(client);
    expect(progress).toMatchObject({
      title: "Babyzimmer einrichten",
      done: 4,
      total: 6,
      pct: 67,
    });
    expect(progress?.icon).toBe("🍼");
  });
});
