import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getWeeklyBalances } from "./accounts";
import { assignTask, setTaskStatus, createTask, listOpenTasks, completeTaskByBoth } from "./tasks";

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

    it("marking completed by both creates two planned entries (one for each person)", async () => {
      const task = await findTaskByTitle("Bad putzen"); // effort 25

      await completeTaskByBoth(task.id, client);

      const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(updated.status).toBe("done");
      expect(updated.reason).toBe("both");

      const entries = await client.accountEntry.findMany({
        where: { taskId: task.id, source: "planned" },
        include: { person: true },
      });
      expect(entries).toHaveLength(2);
      
      const persons = entries.map((e) => e.person.key);
      expect(persons).toContain("dome");
      expect(persons).toContain("emely");
      expect(entries[0]?.points).toBe(25);
      expect(entries[1]?.points).toBe(25);

      // Verify toggling it back to open removes both planned entries
      await setTaskStatus(task.id, "open", null, client);
      
      const afterEntries = await client.accountEntry.findMany({
        where: { taskId: task.id, source: "planned" },
      });
      expect(afterEntries).toHaveLength(0);
    });
  });

  describe("createTask", () => {
    it("creates an open standalone task assigned to a person on the given day", async () => {
      const due = new Date("2026-03-01");
      const { id } = await createTask(
        { title: "Spontan: Fenster putzen", effort: 15, allowedPersons: "dome", dueDate: due, assignToKey: "dome" },
        client,
      );
      const row = await client.task.findUniqueOrThrow({ where: { id }, include: { assignedTo: true } });
      expect(row.status).toBe("open");
      expect(row.type).toBe("todo");
      expect(row.effort).toBe(15);
      expect(row.assignedTo?.key).toBe("dome");
      expect(row.projectId).toBeNull();
    });

    it("leaves assignedTo null when no person is given", async () => {
      const { id } = await createTask(
        { title: "Unzugeordnet", effort: 5, allowedPersons: "both", dueDate: new Date("2026-03-02") },
        client,
      );
      const row = await client.task.findUniqueOrThrow({ where: { id } });
      expect(row.assignedToId).toBeNull();
    });
  });

  describe("listOpenTasks", () => {
    it("returns only open standalone tasks, ordered by dueDate asc", async () => {
      const open = await listOpenTasks(client);
      expect(open.length).toBeGreaterThan(0);
      expect(open.every((t) => typeof t.id === "string")).toBe(true);
      const dues = open.map((t) => t.dueDateISO);
      expect([...dues].sort()).toEqual(dues);
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
