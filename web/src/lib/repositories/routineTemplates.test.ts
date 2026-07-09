import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { listRoutineTemplates, updateRoutineTemplate } from "./tasks";

describe("Routine-Vorlagen (Einstellungen)", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("fasst eine Occurrence-Kette zu genau einer Vorlage zusammen (jüngste Zeile ist Repräsentant)", async () => {
    const parent = await client.task.create({
      data: {
        title: "Testkette putzen",
        type: "routine",
        effort: 10,
        rhythm: "weekly",
        allowedPersons: "both",
        dueDate: new Date("2026-07-01"),
      },
    });
    // Neuere Occurrence derselben Kette mit abweichenden Werten.
    await client.task.create({
      data: {
        title: "Testkette putzen",
        type: "routine",
        effort: 25,
        rhythm: "biweekly",
        allowedPersons: "dome",
        dueDate: new Date("2026-07-08"),
        recurringParentId: parent.id,
      },
    });

    const templates = await listRoutineTemplates(client);
    const mine = templates.filter((t) => t.title === "Testkette putzen");

    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      chainId: parent.id,
      effort: 25, // Werte der jüngsten Zeile
      rhythm: "biweekly",
      allowedPersons: "dome",
    });
  });

  it("schreibt Dauer/Rhythmus/Zuständigkeit auf ALLE Zeilen der Kette", async () => {
    const parent = await client.task.create({
      data: {
        title: "Kette update",
        type: "routine",
        effort: 10,
        rhythm: "weekly",
        allowedPersons: "both",
        dueDate: new Date("2026-07-01"),
      },
    });
    const child = await client.task.create({
      data: {
        title: "Kette update",
        type: "routine",
        effort: 10,
        rhythm: "weekly",
        allowedPersons: "both",
        dueDate: new Date("2026-07-08"),
        recurringParentId: parent.id,
      },
    });

    await updateRoutineTemplate(
      parent.id,
      { effort: 45, rhythm: "monthly", allowedPersons: "emely" },
      client,
    );

    const rows = await client.task.findMany({
      where: { OR: [{ id: parent.id }, { recurringParentId: parent.id }] },
    });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.effort).toBe(45);
      expect(r.rhythm).toBe("monthly");
      expect(r.allowedPersons).toBe("emely");
    }
    // Sicherstellen, dass wirklich beide (parent + child) getroffen wurden.
    expect(rows.map((r) => r.id).sort()).toEqual([parent.id, child.id].sort());
  });

  it("weist ungültige Eingaben ab (Rhythmus, Dauer, Zuständigkeit)", async () => {
    const parent = await client.task.create({
      data: {
        title: "Kette validierung",
        type: "routine",
        effort: 10,
        rhythm: "weekly",
        allowedPersons: "both",
        dueDate: new Date("2026-07-01"),
      },
    });

    await expect(
      updateRoutineTemplate(parent.id, { effort: -5, rhythm: "weekly", allowedPersons: "both" }, client),
    ).rejects.toThrow();
    await expect(
      updateRoutineTemplate(parent.id, { effort: 10, rhythm: "nonsense", allowedPersons: "both" }, client),
    ).rejects.toThrow();
    await expect(
      updateRoutineTemplate(
        parent.id,
        // @ts-expect-error absichtlich ungültiger Wert
        { effort: 10, rhythm: "weekly", allowedPersons: "niemand" },
        client,
      ),
    ).rejects.toThrow();
  });
});
