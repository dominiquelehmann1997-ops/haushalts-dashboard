// Repository for standalone tasks (routines/todos) shown in person/day views.
//
// "Standalone" = `projectId == null`. Project subtasks are excluded here —
// they're surfaced via `projects.ts` instead.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Task, TaskStatus } from "@/lib/domain";
import type { PersonKey } from "@/lib/engine/types";
import { dayBounds } from "@/lib/dates";
import { recordCompletion } from "@/lib/engine/completion";
import { nextSensibleDay } from "@/lib/services/taskDefer";
import { generateNextOccurrence } from "@/lib/services/recurrence";

type TaskRow = {
  id: string;
  title: string;
  effort: number;
  status: string;
  icon: string | null;
  note: string | null;
  sub: string | null;
  assignedTo: { key: string } | null;
};

/** Maps a Prisma `Task` row (with `assignedTo` included) onto the domain `Task` DTO. */
function toDomainTask(row: TaskRow): Task {
  return {
    id: row.id,
    person: row.assignedTo?.key as "dome" | "emely",
    text: row.title,
    mins: row.effort,
    status: row.status as TaskStatus,
    icon: row.icon ?? "",
    note: row.note ?? undefined,
    sub: row.sub ?? undefined,
  };
}

/**
 * Standalone tasks (`projectId == null`) assigned to `personKey` whose
 * `dueDate` falls on the given local day.
 */
export async function getTasksByPerson(
  personKey: "dome" | "emely",
  date: Date,
  client: PrismaClient = prisma,
): Promise<Task[]> {
  const { start, end } = dayBounds(date);

  const rows = await client.task.findMany({
    where: {
      projectId: null,
      dueDate: { gte: start, lte: end },
      assignedTo: { key: personKey },
    },
    include: { assignedTo: true },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(toDomainTask);
}

/** Standalone tasks (both persons) whose `dueDate` falls on the given local day. */
export async function getTasksForDay(date: Date, client: PrismaClient = prisma): Promise<Task[]> {
  const { start, end } = dayBounds(date);

  const rows = await client.task.findMany({
    where: {
      projectId: null,
      dueDate: { gte: start, lte: end },
    },
    include: { assignedTo: true },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(toDomainTask);
}

/** Count of standalone tasks (`projectId == null`) with `status === "open"`. */
export async function getOpenTaskCount(client: PrismaClient = prisma): Promise<number> {
  return client.task.count({
    where: {
      projectId: null,
      status: "open",
    },
  });
}

/**
 * Updates a task's `status` (+ `reason`, `completedAt`) and recomputes its
 * "planned" booking from scratch — making any status transition idempotent:
 *
 * 1. Delete any existing `AccountEntry` for this task with `source: "planned"`.
 * 2. If the new status is `"done"`, reload the task (with `assignedTo`) and run
 *    it through the engine's `recordCompletion`; if it returns an entry, create
 *    the corresponding `AccountEntry` (resolving `personId` from `personKey`,
 *    `occurredAt = now`).
 *
 * Keeps the booking logic single-sourced in the engine — no duplicated points math.
 */
export async function setTaskStatus(
  id: string,
  status: TaskStatus,
  reason: string | null,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.task.update({
    where: { id },
    data: {
      status,
      reason,
      completedAt: status === "done" ? new Date() : null,
    },
  });

  // Recompute the "planned" booking from scratch — idempotent for any transition.
  await client.accountEntry.deleteMany({
    where: { taskId: id, source: "planned" },
  });

  if (status === "done") {
    const task = await client.task.findUniqueOrThrow({
      where: { id },
      include: { assignedTo: true },
    });

    const assignedKey = task.assignedTo?.key;
    const assignedTo: PersonKey | null =
      assignedKey === "dome" || assignedKey === "emely" ? assignedKey : null;

    const entryInput = recordCompletion({
      id: task.id,
      title: task.title,
      status: "done",
      effort: task.effort,
      assignedTo,
    });

    if (entryInput) {
      const person = await client.person.findUniqueOrThrow({
        where: { key: entryInput.personKey },
      });

      await client.accountEntry.create({
        data: {
          personId: person.id,
          label: entryInput.label,
          points: entryInput.points,
          source: entryInput.source,
          taskId: entryInput.taskId,
          occurredAt: new Date(),
        },
      });
    }
  }

  // Recurring routines spawn their next open occurrence once done (idempotent:
  // generateNextOccurrence no-ops for non-routines and guards against duplicates).
  if (status === "done") {
    await generateNextOccurrence(id, client);
  }
}

/** Sets a task's `assignedTo` (resolved by `personKey`) and `dueDate`. */
export async function assignTask(
  id: string,
  personKey: "dome" | "emely",
  day: Date,
  client: PrismaClient = prisma,
): Promise<void> {
  const person = await client.person.findUniqueOrThrow({ where: { key: personKey } });

  await client.task.update({
    where: { id },
    data: {
      assignedToId: person.id,
      dueDate: day,
    },
  });
}

export interface CreateTaskInput {
  title: string;
  type?: string; // default "todo"
  effort: number;
  allowedPersons: "both" | "dome" | "emely";
  dueDate: Date;
  rhythm?: string | null;
  icon?: string | null;
  assignToKey?: "dome" | "emely" | null;
}

/** Creates an open standalone task. Resolves `assignToKey` to a Person id when given. */
export async function createTask(
  input: CreateTaskInput,
  client: PrismaClient = prisma,
): Promise<{ id: string }> {
  let assignedToId: string | null = null;
  if (input.assignToKey) {
    const person = await client.person.findUniqueOrThrow({ where: { key: input.assignToKey } });
    assignedToId = person.id;
  }
  const task = await client.task.create({
    data: {
      title: input.title,
      type: input.type ?? "todo",
      effort: input.effort,
      allowedPersons: input.allowedPersons,
      rhythm: input.rhythm ?? null,
      icon: input.icon ?? null,
      status: "open",
      dueDate: input.dueDate,
      assignedToId,
    },
    select: { id: true },
  });
  return task;
}

export interface OpenTaskDTO {
  id: string;
  title: string;
  icon: string;
  person: "dome" | "emely" | null;
  dueDateISO: string;
  rhythm: string | null;
}

/** All open standalone tasks (incl. not-yet-due), for the "Erledigt nachtragen" picker. */
export async function listOpenTasks(client: PrismaClient = prisma): Promise<OpenTaskDTO[]> {
  const rows = await client.task.findMany({
    where: { projectId: null, status: "open" },
    include: { assignedTo: true },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon ?? "",
    person: r.assignedTo?.key === "dome" || r.assignedTo?.key === "emely" ? r.assignedTo.key : null,
    dueDateISO: r.dueDate.toISOString(),
    rhythm: r.rhythm ?? null,
  }));
}

/**
 * Schiebt eine Aufgabe auf den nächsten sinnvollen Tag (Rhythmus, sonst morgen)
 * und markiert sie als `moved`. `note` dokumentiert die Verschiebung in der UI.
 */
export async function deferTask(
  id: string,
  today: Date,
  client: PrismaClient = prisma,
): Promise<void> {
  const task = await client.task.findUniqueOrThrow({ where: { id } });
  const nextDay = nextSensibleDay({ rhythm: task.rhythm }, today);
  await client.task.update({
    where: { id },
    data: {
      status: "moved",
      reason: null,
      dueDate: nextDay,
      note: nextDay.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }),
    },
  });
}
