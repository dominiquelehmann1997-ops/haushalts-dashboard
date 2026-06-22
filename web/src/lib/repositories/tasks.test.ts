import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { completeTaskBy, deferTask, getOpenTaskCount, getTasksByPerson, getTasksForDay } from "./tasks";

/** Formats a Date as a local "YYYY-MM-DD" key, matching `DayForecast.date`. */
function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

  describe("deferTask", () => {
    it("setzt Status moved und schiebt dueDate auf den nächsten Rhythmus-Tag", async () => {
      const dayStart = new Date(today);
      dayStart.setHours(0, 0, 0, 0);

      const person = await client.person.findUniqueOrThrow({ where: { key: "dome" } });
      const task = await client.task.create({
        data: {
          title: "Bad putzen (klein)",
          type: "routine",
          effort: 15,
          rhythm: "weekly",
          allowedPersons: "both",
          status: "open",
          dueDate: dayStart,
          assignedToId: person.id,
        },
      });

      await deferTask(task.id, dayStart, client);

      const after = await client.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(after.status).toBe("moved");

      const expected = new Date(dayStart);
      expected.setDate(expected.getDate() + 7);
      expect(dateKey(after.dueDate)).toBe(dateKey(expected));
    });

    it("schiebt eine Aufgabe ohne Rhythmus auf morgen", async () => {
      const dayStart = new Date(today);
      dayStart.setHours(0, 0, 0, 0);

      const person = await client.person.findUniqueOrThrow({ where: { key: "emely" } });
      const task = await client.task.create({
        data: {
          title: "Einmalige Aufgabe",
          type: "todo",
          effort: 10,
          rhythm: null,
          allowedPersons: "both",
          status: "open",
          dueDate: dayStart,
          assignedToId: person.id,
        },
      });

      await deferTask(task.id, dayStart, client);

      const after = await client.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(after.status).toBe("moved");

      const expected = new Date(dayStart);
      expected.setDate(expected.getDate() + 1);
      expect(dateKey(after.dueDate)).toBe(dateKey(expected));
      expect(after.note).toBeTruthy();
    });
  });
});

describe("completeTaskBy", () => {
  let client: PrismaClient;
  const today = new Date();

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("schreibt die Punkte dem Erlediger gut, nicht dem ursprünglich Zugewiesenen", async () => {
    const emely = await client.person.findUniqueOrThrow({ where: { key: "emely" } });
    const task = await client.task.create({
      data: {
        title: "Gassi gehen",
        type: "routine",
        effort: 45,
        status: "open",
        allowedPersons: "both",
        outdoor: false,
        rhythm: "daily",
        assignedToId: emely.id,
        dueDate: today,
      },
    });

    await completeTaskBy(task.id, "dome", client);

    const entries = await client.accountEntry.findMany({
      where: { taskId: task.id },
      include: { person: true },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.person.key).toBe("dome");
    expect(entries[0]!.points).toBe(45);

    const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.status).toBe("done");
  });
});
