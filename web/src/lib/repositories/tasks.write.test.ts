import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getWeeklyBalances } from "./accounts";
import { assignTask, setTaskStatus } from "./tasks";

describe("tasks repository (writes)", () => {
  let client: PrismaClient;
  const today = new Date();

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  async function findTaskByTitle(title: string) {
    const task = await client.task.findFirstOrThrow({ where: { title } });
    return task;
  }

  describe("setTaskStatus", () => {
    it("open -> done creates a planned booking with points = effort and increases the weekly balance", async () => {
      // "Rasen mähen": status "moved", assignedTo dome, effort 20 — and (unlike
      // the other seeded standalone tasks) has NO pre-existing planned booking,
      // so the balance delta is exactly its effort.
      const task = await findTaskByTitle("Rasen mähen");
      expect(task.status).toBe("moved");
      const before = await getWeeklyBalances(client);

      await setTaskStatus(task.id, "done", null, client);

      const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(updated.status).toBe("done");
      expect(updated.completedAt).not.toBeNull();

      const entries = await client.accountEntry.findMany({
        where: { taskId: task.id, source: "planned" },
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]?.points).toBe(20);

      const after = await getWeeklyBalances(client);
      expect(after.dome).toBe(before.dome + 20);
    });

    it("done -> open removes the planned booking again", async () => {
      const task = await findTaskByTitle("Müll rausbringen"); // seeded done, has a planned entry (5 pts)
      const before = await getWeeklyBalances(client);

      await setTaskStatus(task.id, "open", null, client);

      const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(updated.status).toBe("open");
      expect(updated.completedAt).toBeNull();

      const entries = await client.accountEntry.findMany({
        where: { taskId: task.id, source: "planned" },
      });
      expect(entries).toHaveLength(0);

      const after = await getWeeklyBalances(client);
      expect(after.dome).toBe(before.dome - 5);
    });

    it("-> failed with a reason stores status + reason and creates no booking", async () => {
      const task = await findTaskByTitle("Abendessen kochen"); // open, assignedTo dome, effort 30

      await setTaskStatus(task.id, "failed", "Keine Zeit", client);

      const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(updated.status).toBe("failed");
      expect(updated.reason).toBe("Keine Zeit");
      expect(updated.completedAt).toBeNull();

      const entries = await client.accountEntry.findMany({
        where: { taskId: task.id, source: "planned" },
      });
      expect(entries).toHaveLength(0);
    });

    it("toggling done twice does not create duplicate bookings", async () => {
      const task = await findTaskByTitle("Bad putzen");

      await setTaskStatus(task.id, "done", null, client);
      await setTaskStatus(task.id, "open", null, client);
      await setTaskStatus(task.id, "done", null, client);

      const entries = await client.accountEntry.findMany({
        where: { taskId: task.id, source: "planned" },
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]?.points).toBe(25);
    });
  });

  describe("assignTask", () => {
    it("assigns the person and due date", async () => {
      const task = await findTaskByTitle("Wäsche zusammenlegen");
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await assignTask(task.id, "dome", tomorrow, client);

      const updated = await client.task.findUniqueOrThrow({
        where: { id: task.id },
        include: { assignedTo: true },
      });
      expect(updated.assignedTo?.key).toBe("dome");
      expect(updated.dueDate.toDateString()).toBe(tomorrow.toDateString());
    });
  });
});
