import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { generateNextOccurrence, nextDueDate, rescheduleOpenOccurrence } from "./recurrence";

describe("nextDueDate (pure)", () => {
  const from = new Date(2026, 5, 7); // local date, arbitrary

  it("daily -> +1 day", () => {
    const result = nextDueDate("daily", from);
    expect(result.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("weekly -> +7 days", () => {
    const result = nextDueDate("weekly", from);
    expect(result.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("biweekly -> +14 days", () => {
    const result = nextDueDate("biweekly", from);
    expect(result.getTime() - from.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it("2x-week -> +3 days", () => {
    const result = nextDueDate("2x-week", from);
    expect(result.getTime() - from.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("3-day -> +3 days", () => {
    const result = nextDueDate("3-day", from);
    expect(result.getTime() - from.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("5-day -> +5 days", () => {
    const result = nextDueDate("5-day", from);
    expect(result.getTime() - from.getTime()).toBe(5 * 24 * 60 * 60 * 1000);
  });

  it("monthly -> +1 calendar month (same day-of-month)", () => {
    const result = nextDueDate("monthly", new Date(2026, 5, 12)); // 12 Jun 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6); // Jul
    expect(result.getDate()).toBe(12);
  });

  it("halfyearly -> +6 calendar months across the year boundary", () => {
    const result = nextDueDate("halfyearly", new Date(2026, 7, 12)); // 12 Aug 2026
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(12);
  });

  it("freies Intervall '10-day' -> +10 Tage", () => {
    const result = nextDueDate("10-day", from);
    expect(result.getTime() - from.getTime()).toBe(10 * 24 * 60 * 60 * 1000);
  });

  it("unknown rhythm -> defaults to +7 days", () => {
    const result = nextDueDate("monthly-ish-nonsense", from);
    expect(result.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("ungültiges freies Intervall ('0-day') fällt auf +7 Tage zurück", () => {
    const result = nextDueDate("0-day", from);
    expect(result.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("does not mutate the input date", () => {
    const original = new Date(from);
    nextDueDate("daily", from);
    expect(from.getTime()).toBe(original.getTime());
  });

  it("returns a new Date instance", () => {
    const result = nextDueDate("daily", from);
    expect(result).not.toBe(from);
    expect(result instanceof Date).toBe(true);
  });
});

describe("generateNextOccurrence", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  async function makeRoutineTask(overrides: Partial<{ status: string; rhythm: string | null }> = {}) {
    const dome = await client.person.findFirstOrThrow({ where: { key: "dome" } });
    const dueDate = new Date();
    dueDate.setHours(0, 0, 0, 0);

    return client.task.create({
      data: {
        title: "Pflanzen gießen",
        type: "routine",
        effort: 10,
        rhythm: "weekly",
        allowedPersons: "both",
        status: "done",
        assignedToId: dome.id,
        dueDate,
        completedAt: dueDate,
        ...overrides,
      },
    });
  }

  it("creates one open successor at the next due date for a done routine task", async () => {
    const task = await makeRoutineTask();

    const created = await generateNextOccurrence(task.id, client);

    expect(created).not.toBeNull();
    expect(created?.status).toBe("open");
    expect(created?.assignedToId).toBeNull();
    expect(created?.recurringParentId).toBe(task.id);
    expect(created?.title).toBe(task.title);
    expect(created?.effort).toBe(task.effort);
    expect(created?.rhythm).toBe(task.rhythm);
    expect(created!.dueDate.getTime() - task.dueDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("does not create a second successor when one already exists", async () => {
    const task = await makeRoutineTask();

    const first = await generateNextOccurrence(task.id, client);
    expect(first).not.toBeNull();

    const second = await generateNextOccurrence(task.id, client);
    expect(second).toBeNull();

    const successors = await client.task.findMany({
      where: { recurringParentId: task.id },
    });
    expect(successors).toHaveLength(1);
  });

  it("does not create a successor when a moved successor already exists", async () => {
    const task = await makeRoutineTask();
    await client.task.create({
      data: {
        title: task.title,
        type: "routine",
        effort: task.effort,
        rhythm: task.rhythm,
        allowedPersons: "both",
        status: "moved",
        recurringParentId: task.id,
        dueDate: new Date(task.dueDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
    });

    const created = await generateNextOccurrence(task.id, client);
    expect(created).toBeNull();
  });

  it("returns null for a non-routine task", async () => {
    const dome = await client.person.findFirstOrThrow({ where: { key: "dome" } });
    const dueDate = new Date();
    const task = await client.task.create({
      data: {
        title: "Einmaliges Todo",
        type: "todo",
        effort: 10,
        allowedPersons: "both",
        status: "done",
        assignedToId: dome.id,
        dueDate,
        completedAt: dueDate,
      },
    });

    const created = await generateNextOccurrence(task.id, client);
    expect(created).toBeNull();
  });

  it("returns null for a routine task that is still open", async () => {
    const task = await makeRoutineTask({ status: "open" });

    const created = await generateNextOccurrence(task.id, client);
    expect(created).toBeNull();
  });

  it('legt auch nach "failed" einen Nachfolger an — eine verpasste Woche beendet keine Routine', async () => {
    const task = await makeRoutineTask({ status: "failed" });
    // setTaskStatus setzt completedAt bei "failed" auf null; hier nachstellen.
    await client.task.update({ where: { id: task.id }, data: { completedAt: null } });

    const created = await generateNextOccurrence(task.id, client);

    expect(created).not.toBeNull();
    expect(created?.status).toBe("open");
    expect(created?.assignedToId).toBeNull();
    expect(created?.recurringParentId).toBe(task.id);
    // Ohne Erledigung zählt der Plantag: weekly = +7 Tage ab dueDate.
    expect(created!.dueDate.getTime() - task.dueDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('legt nach "failed" keinen zweiten Nachfolger an', async () => {
    const task = await makeRoutineTask({ status: "failed" });
    await client.task.update({ where: { id: task.id }, data: { completedAt: null } });

    expect(await generateNextOccurrence(task.id, client)).not.toBeNull();
    expect(await generateNextOccurrence(task.id, client)).toBeNull();

    const successors = await client.task.findMany({ where: { recurringParentId: task.id } });
    expect(successors).toHaveLength(1);
  });
});

describe("generateNextOccurrence — restart + learned interval", () => {
  let client: PrismaClient;
  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });
  afterAll(async () => {
    await client?.$disconnect();
  });

  it("bases the next dueDate on completedAt, not the old dueDate (interval restart)", async () => {
    const due = new Date("2026-01-01T00:00:00.000Z");
    const completedAt = new Date("2026-01-10T12:00:00.000Z"); // done 9 days late
    const routine = await client.task.create({
      data: {
        title: "Test-Routine", type: "routine", effort: 10, allowedPersons: "both",
        rhythm: "weekly", status: "done", dueDate: due, completedAt,
      },
    });

    const next = await generateNextOccurrence(routine.id, client);

    expect(next).not.toBeNull();
    // weekly = +7 days from completedAt (2026-01-10), NOT from dueDate (2026-01-01)
    expect(next!.dueDate.toISOString().slice(0, 10)).toBe("2026-01-17");
  });

  it("uses the learned interval once enough completions exist in the chain", async () => {
    // Build a chain of 4 completions ~3 days apart -> learned < weekly(7)
    const chainBase = await client.task.create({
      data: {
        title: "Häufige Routine", type: "routine", effort: 5, allowedPersons: "both",
        rhythm: "weekly", status: "done",
        dueDate: new Date("2026-02-01"), completedAt: new Date("2026-02-01"),
      },
    });
    const days = ["2026-02-04", "2026-02-07", "2026-02-10"];
    let last = chainBase;
    for (const d of days) {
      last = await client.task.create({
        data: {
          title: "Häufige Routine", type: "routine", effort: 5, allowedPersons: "both",
          rhythm: "weekly", status: "done", recurringParentId: chainBase.id,
          dueDate: new Date(d), completedAt: new Date(d),
        },
      });
    }

    const next = await generateNextOccurrence(last.id, client);

    expect(next).not.toBeNull();
    // gaps ~3 days -> next due ~3 days after 2026-02-10, well before +7 (2026-02-17)
    const offsetDays =
      (next!.dueDate.getTime() - new Date("2026-02-10").getTime()) / 86_400_000;
    expect(offsetDays).toBeLessThan(7);
    expect(offsetDays).toBeGreaterThan(0);
  });

  it('keeps a "daily" routine daily even after a sloppy history (Gassi gehen)', async () => {
    // Reale Kette aus der Produktion: anfangs täglich, dann driftend, mit einer
    // Urlaubslücke am Ende. Ohne FIXED_RHYTHMS lernte das ~3 Tage.
    const chainBase = await client.task.create({
      data: {
        title: "Gassi gehen", type: "routine", effort: 45, allowedPersons: "both",
        rhythm: "daily", status: "done",
        dueDate: new Date("2026-03-01"), completedAt: new Date("2026-03-01"),
      },
    });
    let last = chainBase;
    for (const d of ["2026-03-03", "2026-03-05", "2026-03-07", "2026-03-13"]) {
      last = await client.task.create({
        data: {
          title: "Gassi gehen", type: "routine", effort: 45, allowedPersons: "both",
          rhythm: "daily", status: "done", recurringParentId: chainBase.id,
          dueDate: new Date(d), completedAt: new Date(d),
        },
      });
    }

    const next = await generateNextOccurrence(last.id, client);

    expect(next).not.toBeNull();
    const offsetDays =
      (next!.dueDate.getTime() - new Date("2026-03-13").getTime()) / 86_400_000;
    expect(offsetDays).toBe(1);
  });

  it("caps a learned interval at twice the configured rhythm", async () => {
    // 3-day-Routine, real alle ~9 Tage erledigt -> gelernt wäre 9, Deckel ist 6.
    const chainBase = await client.task.create({
      data: {
        title: "Treppe saugen", type: "routine", effort: 5, allowedPersons: "both",
        rhythm: "3-day", status: "done",
        dueDate: new Date("2026-04-01"), completedAt: new Date("2026-04-01"),
      },
    });
    let last = chainBase;
    for (const d of ["2026-04-10", "2026-04-19", "2026-04-28"]) {
      last = await client.task.create({
        data: {
          title: "Treppe saugen", type: "routine", effort: 5, allowedPersons: "both",
          rhythm: "3-day", status: "done", recurringParentId: chainBase.id,
          dueDate: new Date(d), completedAt: new Date(d),
        },
      });
    }

    const next = await generateNextOccurrence(last.id, client);

    expect(next).not.toBeNull();
    const offsetDays =
      (next!.dueDate.getTime() - new Date("2026-04-28").getTime()) / 86_400_000;
    expect(offsetDays).toBe(6); // 2 x 3, nicht 9
  });

  it('behandelt das freie Intervall "1-day" wie "daily" und lernt es nicht', async () => {
    const chainBase = await client.task.create({
      data: {
        title: "Frei täglich", type: "routine", effort: 5, allowedPersons: "both",
        rhythm: "1-day", status: "done",
        dueDate: new Date("2026-05-01"), completedAt: new Date("2026-05-01"),
      },
    });
    let last = chainBase;
    for (const d of ["2026-05-04", "2026-05-07", "2026-05-10"]) {
      last = await client.task.create({
        data: {
          title: "Frei täglich", type: "routine", effort: 5, allowedPersons: "both",
          rhythm: "1-day", status: "done", recurringParentId: chainBase.id,
          dueDate: new Date(d), completedAt: new Date(d),
        },
      });
    }

    const next = await generateNextOccurrence(last.id, client);

    expect(next).not.toBeNull();
    const offsetDays =
      (next!.dueDate.getTime() - new Date("2026-05-10").getTime()) / 86_400_000;
    expect(offsetDays).toBe(1);
  });
});

describe("rescheduleOpenOccurrence", () => {
  let client: PrismaClient;
  const DAY_MS = 86_400_000;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });
  afterAll(async () => {
    await client?.$disconnect();
  });

  function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Kette mit einer erledigten und einer offenen Zeile. */
  async function makeChain(
    title: string,
    completedAt: Date | null,
    openOverrides: Record<string, unknown> = {},
  ) {
    const parent = await client.task.create({
      data: {
        title, type: "routine", effort: 10, allowedPersons: "both", rhythm: "weekly",
        status: completedAt ? "done" : "open",
        completedAt,
        dueDate: completedAt ?? today(),
      },
    });
    const open = await client.task.create({
      data: {
        title, type: "routine", effort: 10, allowedPersons: "both", rhythm: "weekly",
        status: "open", dueDate: new Date(today().getTime() + 30 * DAY_MS),
        recurringParentId: parent.id,
        ...openOverrides,
      },
    });
    return { parent, open };
  }

  it("rechnet ab der letzten Erledigung", async () => {
    const done = daysAgo(1);
    const { parent, open } = await makeChain("Ab Erledigung", done);

    const result = await rescheduleOpenOccurrence(parent.id, "3-day", today(), client);

    expect(result?.getTime()).toBe(done.getTime() + 3 * DAY_MS);
    const row = await client.task.findUniqueOrThrow({ where: { id: open.id } });
    expect(row.dueDate.getTime()).toBe(done.getTime() + 3 * DAY_MS);
  });

  it("rechnet ab heute, wenn die Kette nie erledigt wurde", async () => {
    const parent = await client.task.create({
      data: {
        title: "Nie erledigt", type: "routine", effort: 10, allowedPersons: "both",
        rhythm: "weekly", status: "open", dueDate: today(),
      },
    });

    const result = await rescheduleOpenOccurrence(parent.id, "5-day", today(), client);

    expect(result?.getTime()).toBe(today().getTime() + 5 * DAY_MS);
  });

  it("zieht höchstens auf heute vor, nie in die Vergangenheit", async () => {
    const { parent, open } = await makeChain("Lange her", daysAgo(40));

    const result = await rescheduleOpenOccurrence(parent.id, "daily", today(), client);

    expect(result?.getTime()).toBe(today().getTime());
    const row = await client.task.findUniqueOrThrow({ where: { id: open.id } });
    expect(row.dueDate.getTime()).toBe(today().getTime());
  });

  it("versteht freie Intervalle", async () => {
    const done = daysAgo(1);
    const { parent } = await makeChain("Frei", done);

    const result = await rescheduleOpenOccurrence(parent.id, "10-day", today(), client);

    expect(result?.getTime()).toBe(done.getTime() + 10 * DAY_MS);
  });

  it("lässt eine verschobene Zeile in Ruhe — die Verschiebung war Absicht", async () => {
    const movedDue = new Date(today().getTime() + 30 * DAY_MS);
    const { parent, open } = await makeChain("Verschoben", daysAgo(1), {
      status: "moved",
      dueDate: movedDue,
    });

    const result = await rescheduleOpenOccurrence(parent.id, "daily", today(), client);

    expect(result).toBeNull();
    const row = await client.task.findUniqueOrThrow({ where: { id: open.id } });
    expect(row.dueDate.getTime()).toBe(movedDue.getTime());
  });

  it("lässt eine bereits zugewiesene Aufgabe in Ruhe — sie steht im Tagesplan", async () => {
    const dome = await client.person.findFirstOrThrow({ where: { key: "dome" } });
    const assignedDue = new Date(today().getTime() + 30 * DAY_MS);
    const { parent, open } = await makeChain("Zugewiesen", daysAgo(1), {
      assignedToId: dome.id,
      dueDate: assignedDue,
    });

    const result = await rescheduleOpenOccurrence(parent.id, "daily", today(), client);

    expect(result).toBeNull();
    const row = await client.task.findUniqueOrThrow({ where: { id: open.id } });
    expect(row.dueDate.getTime()).toBe(assignedDue.getTime());
  });
});
