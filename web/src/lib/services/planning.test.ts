import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { dayBounds } from "@/lib/dates";
import { selectByFairness } from "@/lib/engine/fairness";
import type { DayForecast } from "@/lib/engine/types";
import { getWeeklyBalances } from "@/lib/repositories/accounts";

import { planDueTasks } from "./planning";

describe("planning service", () => {
  let client: PrismaClient;
  const today = new Date();

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  async function createOpenStandaloneTask(input: {
    title: string;
    allowedPersons: "both" | "dome" | "emely";
    effort: number;
  }) {
    return client.task.create({
      data: {
        title: input.title,
        type: "todo",
        effort: input.effort,
        status: "open",
        allowedPersons: input.allowedPersons,
        outdoor: false,
        assignedToId: null,
        dueDate: today,
      },
    });
  }

  /** Formats a Date as a local "YYYY-MM-DD" key, matching `DayForecast.date`. */
  function dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async function createOpenOutdoorTask(input: {
    title: string;
    allowedPersons: "both" | "dome" | "emely";
    effort: number;
    weatherCondition: { noRain: boolean; minTemp?: number };
    dueDate: Date;
  }) {
    return client.task.create({
      data: {
        title: input.title,
        type: "todo",
        effort: input.effort,
        status: "open",
        allowedPersons: input.allowedPersons,
        outdoor: true,
        weatherCondition: JSON.stringify(input.weatherCondition),
        assignedToId: null,
        dueDate: input.dueDate,
      },
    });
  }

  it("returns [] when all of today's due tasks are already assigned", async () => {
    const decisions = await planDueTasks(today, {}, client);
    expect(decisions).toEqual([]);
  });

  it("assigns a single unassigned 'both' task to the fairer person and books the decision", async () => {
    const balances = await getWeeklyBalances(client);
    // Active phase (seeded): mode "elternzeit", target { dome: 60, emely: 40 }.
    const expectedPerson = selectByFairness(["dome", "emely"], balances, { dome: 60, emely: 40 });

    const task = await createOpenStandaloneTask({
      title: "Spülmaschine ausräumen",
      allowedPersons: "both",
      effort: 10,
    });

    const decisions = await planDueTasks(today, {}, client);

    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      taskId: task.id,
      result: { kind: "assigned", person: expectedPerson },
    });

    const updated = await client.task.findUniqueOrThrow({
      where: { id: task.id },
      include: { assignedTo: true },
    });
    expect(updated.assignedTo?.key).toBe(expectedPerson);

    const { start, end } = dayBounds(today);
    expect(updated.dueDate.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(updated.dueDate.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it("assigns an 'emely'-only task to emely", async () => {
    const task = await createOpenStandaloneTask({
      title: "Stillen begleiten",
      allowedPersons: "emely",
      effort: 10,
    });

    const decisions = await planDueTasks(today, {}, client);

    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      taskId: task.id,
      result: { kind: "assigned", person: "emely" },
    });

    const updated = await client.task.findUniqueOrThrow({
      where: { id: task.id },
      include: { assignedTo: true },
    });
    expect(updated.assignedTo?.key).toBe("emely");
  });

  it("spreads two unassigned 'both' tasks via incremental balance updates within the batch", async () => {
    const initialBalances = await getWeeklyBalances(client);
    const target = { dome: 60, emely: 40 };

    const firstPerson = selectByFairness(["dome", "emely"], initialBalances, target);
    const effortFirst = 10;
    const updatedBalances = { ...initialBalances, [firstPerson]: initialBalances[firstPerson] + effortFirst };
    const secondPerson = selectByFairness(["dome", "emely"], updatedBalances, target);

    const taskA = await createOpenStandaloneTask({
      title: "Geschirrspüler einräumen",
      allowedPersons: "both",
      effort: effortFirst,
    });
    const taskB = await createOpenStandaloneTask({
      title: "Betten frisch beziehen",
      allowedPersons: "both",
      effort: 10,
    });

    const decisions = await planDueTasks(today, {}, client);

    expect(decisions).toHaveLength(2);
    expect(decisions[0]).toMatchObject({
      taskId: taskA.id,
      result: { kind: "assigned", person: firstPerson },
    });
    expect(decisions[1]).toMatchObject({
      taskId: taskB.id,
      result: { kind: "assigned", person: secondPerson },
    });

    const both = await client.task.findMany({
      where: { id: { in: [taskA.id, taskB.id] } },
      include: { assignedTo: true },
    });
    for (const t of both) {
      expect(t.assignedTo?.key).toBeDefined();
    }
  });

  it("assigns away from a person whose day is fully booked (busy → dayLoad)", async () => {
    await createOpenStandaloneTask({ title: "Wäsche", allowedPersons: "both", effort: 1 });

    // `today` ist im Test-Scope als `const today = new Date()` vorhanden; createOpenStandaloneTask setzt dueDate: today.
    const d = today.getDate();
    const busy = [
      {
        person: "dome" as const,
        start: new Date(today.getFullYear(), today.getMonth(), d, 7, 0),
        end: new Date(today.getFullYear(), today.getMonth(), d, 23, 0),
      },
    ];

    const decisions = await planDueTasks(today, { busy }, client);

    expect(decisions).toHaveLength(1);
    expect(decisions[0].result).toMatchObject({ kind: "assigned", person: "emely" });
  });

  it("defers an unassigned outdoor 'noRain' task due today to a later dry day, given an injected forecast", async () => {
    // Local midnight, two days from today — matches `checkWeather`'s
    // `fromLocalDateKey(later.date)` (which the engine uses as `suggestedDay`).
    const dryDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

    const forecast: DayForecast[] = [
      {
        date: dateKey(today),
        rainWindows: [{ from: "00:00", to: "23:59" }],
        minTemp: 10,
        maxTemp: 16,
      },
      {
        date: dateKey(dryDay),
        rainWindows: [],
        minTemp: 12,
        maxTemp: 20,
      },
    ];

    const task = await createOpenOutdoorTask({
      title: "Garten umgraben",
      allowedPersons: "both",
      effort: 30,
      weatherCondition: { noRain: true },
      dueDate: today,
    });

    const decisions = await planDueTasks(today, { forecast }, client);

    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      taskId: task.id,
      result: { kind: "deferred", suggestedDay: dryDay },
    });

    const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.status).toBe("moved");
    expect(updated.dueDate.getTime()).toBe(dryDay.getTime());
  });
});
