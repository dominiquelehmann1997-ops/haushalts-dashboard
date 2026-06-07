// Repository for standalone tasks (routines/todos) shown in person/day views.
//
// "Standalone" = `projectId == null`. Project subtasks are excluded here —
// they're surfaced via `projects.ts` instead.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Task, TaskStatus } from "@/lib/domain";
import { dayBounds } from "@/lib/dates";

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
