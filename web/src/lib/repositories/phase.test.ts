import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getActivePhase } from "./phase";

describe("phase repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getActivePhase returns the active PhaseSetting mapped to its DTO shape", async () => {
    const phase = await getActivePhase(client);
    expect(phase).toEqual({
      mode: "elternzeit",
      targetDome: 60,
      targetEmely: 40,
      caregiverKey: "emely",
    });
  });
});
