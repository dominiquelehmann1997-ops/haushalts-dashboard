import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { importChores } from "./choreImport";
import { CHORES } from "@/lib/services/chores";

const today = new Date(2026, 5, 12);

describe("importChores", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("creates exactly one task per chore title", async () => {
    await importChores(client, today);

    for (const chore of CHORES) {
      const count = await client.task.count({ where: { title: chore.title } });
      expect(count, chore.title).toBe(1);
    }
  });

  it("sets Rasen mähen to Dome-only", async () => {
    await importChores(client, today);

    const rasen = await client.task.findFirst({ where: { title: "Rasen mähen" } });
    expect(rasen?.allowedPersons).toBe("dome");
    expect(rasen?.outdoor).toBe(true);
    expect(rasen?.weatherCondition).toBe('{"noRain":true}');
  });

  it("is idempotent: a second run creates no duplicates", async () => {
    await importChores(client, today);
    const after1 = await client.task.count();

    await importChores(client, today);
    const after2 = await client.task.count();

    expect(after2).toBe(after1);
    for (const chore of CHORES) {
      const count = await client.task.count({ where: { title: chore.title } });
      expect(count, chore.title).toBe(1);
    }
  });

  it("preserves an existing task's dueDate and status on re-import", async () => {
    await importChores(client, today);
    const before = await client.task.findFirstOrThrow({ where: { title: "Staub wischen" } });
    await client.task.update({
      where: { id: before.id },
      data: { status: "done", dueDate: new Date(2026, 0, 1) },
    });

    await importChores(client, today);

    const after = await client.task.findFirstOrThrow({ where: { title: "Staub wischen" } });
    expect(after.status).toBe("done");
    expect(after.dueDate.getTime()).toBe(new Date(2026, 0, 1).getTime());
  });
});
