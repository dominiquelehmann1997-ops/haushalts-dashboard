import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { rolloverOpenTasks } from "./rollover";

describe("rolloverOpenTasks", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("advances dueDate of an open standalone task on fromDay to toDay", async () => {
    const task = await client.task.findFirstOrThrow({ where: { title: "Bad putzen" } }); // open, today

    const fromDay = new Date(task.dueDate);
    const toDay = new Date(fromDay);
    toDay.setDate(toDay.getDate() + 1);

    const count = await rolloverOpenTasks(fromDay, toDay, client);
    expect(count).toBeGreaterThanOrEqual(1);

    const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.dueDate.toDateString()).toBe(toDay.toDateString());
  });

  it("leaves a done task on fromDay untouched", async () => {
    const task = await client.task.findFirstOrThrow({ where: { title: "Müll rausbringen" } }); // done, today

    const fromDay = new Date(task.dueDate);
    const toDay = new Date(fromDay);
    toDay.setDate(toDay.getDate() + 1);

    await rolloverOpenTasks(fromDay, toDay, client);

    const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.dueDate.toDateString()).toBe(fromDay.toDateString());
    expect(updated.status).toBe("done");
  });
});
