import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getOpenTaskCount, getTasksByPerson, getTasksForDay } from "./tasks";

describe("tasks repository", () => {
  let client: PrismaClient;
  const today = new Date();

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getTasksByPerson returns dome's standalone tasks for today", async () => {
    const tasks = await getTasksByPerson("dome", today, client);

    expect(tasks).toHaveLength(4);
    expect(tasks.every((t) => t.person === "dome")).toBe(true);

    const byText = Object.fromEntries(tasks.map((t) => [t.text, t]));
    expect(byText["Müll rausbringen"]?.status).toBe("done");
    expect(byText["Abendessen kochen"]?.status).toBe("open");
    expect(byText["Bad putzen"]?.status).toBe("open");
    expect(byText["Rasen mähen"]?.status).toBe("moved");
  });

  it("getTasksByPerson returns emely's standalone tasks for today", async () => {
    const tasks = await getTasksByPerson("emely", today, client);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ person: "emely", text: "Wäsche zusammenlegen" });
  });

  it("getTasksForDay returns standalone tasks for both persons on that day", async () => {
    const tasks = await getTasksForDay(today, client);
    expect(tasks).toHaveLength(5);
  });

  it("getOpenTaskCount counts standalone tasks with status 'open'", async () => {
    const count = await getOpenTaskCount(client);
    expect(count).toBe(3);
  });
});
