import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { dayBounds, addDays } from "@/lib/dates";

import { rollOverdueRoutines } from "./overdueCatchup";

describe("rollOverdueRoutines", () => {
  let client: PrismaClient;
  const today = new Date();

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  function makeRoutine(input: {
    title: string;
    dueDate: Date;
    rhythm?: string | null;
    recurringParentId?: string | null;
    status?: "open" | "done" | "moved";
  }) {
    return client.task.create({
      data: {
        title: input.title,
        type: "routine",
        effort: 10,
        status: input.status ?? "open",
        allowedPersons: "both",
        outdoor: false,
        rhythm: input.rhythm === undefined ? "weekly" : input.rhythm,
        recurringParentId: input.recurringParentId ?? null,
        assignedToId: null,
        dueDate: input.dueDate,
      },
    });
  }

  it("zieht eine überfällige Routine auf heute und behält die Zuweisung bei", async () => {
    const dome = await client.person.findUniqueOrThrow({ where: { key: "dome" } });
    const t = await makeRoutine({ title: "Treppe saugen", dueDate: addDays(today, -3) });
    await client.task.update({ where: { id: t.id }, data: { assignedToId: dome.id } });

    const result = await rollOverdueRoutines(today, client);

    const updated = await client.task.findUniqueOrThrow({ where: { id: t.id } });
    const { start, end } = dayBounds(today);
    expect(updated.dueDate >= start && updated.dueDate <= end).toBe(true);
    expect(updated.assignedToId).toBe(dome.id);
    expect(result.rolled).toBe(1);
  });

  it("behält pro Kette die jüngste offene Occurrence und löscht ältere Duplikate", async () => {
    const parent = await makeRoutine({ title: "Bad putzen", dueDate: addDays(today, -9) });
    const newer = await makeRoutine({
      title: "Bad putzen",
      dueDate: addDays(today, -2),
      recurringParentId: parent.id,
    });

    const result = await rollOverdueRoutines(today, client);

    const parentRow = await client.task.findUnique({ where: { id: parent.id } });
    const newerRow = await client.task.findUnique({ where: { id: newer.id } });
    expect(parentRow).toBeNull(); // ältere Occurrence gelöscht
    expect(newerRow).not.toBeNull(); // jüngere behalten
    expect(result.deletedDuplicates).toBe(1);
    const { start, end } = dayBounds(today);
    expect(newerRow!.dueDate >= start && newerRow!.dueDate <= end).toBe(true);
  });

  it("ignoriert rhythm=null (Shopping) und bereits heute/zukünftig fällige", async () => {
    const shopping = await makeRoutine({ title: "Einkaufen", dueDate: addDays(today, -4), rhythm: null });
    const todayTask = await makeRoutine({ title: "Gassi gehen", dueDate: today, rhythm: "daily" });
    const future = await makeRoutine({ title: "Fenster putzen", dueDate: addDays(today, 5) });

    await rollOverdueRoutines(today, client);

    const s = await client.task.findUniqueOrThrow({ where: { id: shopping.id } });
    const fu = await client.task.findUniqueOrThrow({ where: { id: future.id } });
    expect(s.dueDate.getTime()).toBe(addDays(today, -4).getTime()); // unberührt
    expect(fu.dueDate.getTime()).toBe(addDays(today, 5).getTime()); // unberührt
    await client.task.findUniqueOrThrow({ where: { id: todayTask.id } }); // existiert noch
  });

  it("öffnet verschobene Aufgaben wieder, sobald ihr Zieltag erreicht ist", async () => {
    const routine = await makeRoutine({ title: "Monty bürsten", dueDate: today, status: "moved" });
    const todo = await client.task.create({
      data: {
        title: "Pfand wegbringen",
        type: "todo",
        effort: 5,
        status: "moved",
        allowedPersons: "both",
        outdoor: false,
        dueDate: today,
      },
    });
    const future = await makeRoutine({
      title: "Fenster putzen",
      dueDate: addDays(today, 3),
      status: "moved",
    });

    const result = await rollOverdueRoutines(today, client);

    expect((await client.task.findUniqueOrThrow({ where: { id: routine.id } })).status).toBe("open");
    expect((await client.task.findUniqueOrThrow({ where: { id: todo.id } })).status).toBe("open");
    expect((await client.task.findUniqueOrThrow({ where: { id: future.id } })).status).toBe("moved");
    // Seed enthält selbst eine verschobene Aufgabe → mindestens unsere zwei.
    expect(result.reopened).toBeGreaterThanOrEqual(2);
  });

  it("bereinigt Duplikate aus verschobener + offener Occurrence derselben Kette", async () => {
    const movedParent = await makeRoutine({
      title: "Monty bürsten",
      dueDate: addDays(today, -1),
      status: "moved",
    });
    const openChild = await makeRoutine({
      title: "Monty bürsten",
      dueDate: today,
      recurringParentId: movedParent.id,
    });

    await rollOverdueRoutines(today, client);

    const rows = await client.task.findMany({ where: { title: "Monty bürsten" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(openChild.id);
    expect(rows[0]!.status).toBe("open");
  });

  it("ist idempotent: zweiter Lauf am selben Tag ändert nichts mehr", async () => {
    await makeRoutine({ title: "Staub wischen", dueDate: addDays(today, -3) });
    await rollOverdueRoutines(today, client);
    const second = await rollOverdueRoutines(today, client);
    expect(second.rolled).toBe(0);
    expect(second.deletedDuplicates).toBe(0);
  });
});
