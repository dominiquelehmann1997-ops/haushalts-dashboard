import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { dayBounds } from "@/lib/dates";
import { selectByFairness } from "@/lib/engine/fairness";
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

  it("returns [] when all of today's due tasks are already assigned", async () => {
    const decisions = await planDueTasks(today, client);
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

    const decisions = await planDueTasks(today, client);

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

    const decisions = await planDueTasks(today, client);

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

    const decisions = await planDueTasks(today, client);

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
});
