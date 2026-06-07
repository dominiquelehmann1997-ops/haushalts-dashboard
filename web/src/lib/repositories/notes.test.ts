import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getNotes } from "./notes";

describe("notes repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getNotes returns pinned notes first, mapped to the domain DTO", async () => {
    const notes = await getNotes(client);

    expect(notes).toHaveLength(3);
    expect(notes[0]).toMatchObject({ icon: "📌", text: "Hebammen-Termin bestätigen" });
  });
});
