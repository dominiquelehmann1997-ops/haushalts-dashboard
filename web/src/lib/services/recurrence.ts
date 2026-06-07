// Recurrence service: computes the next due date for a recurring task's
// rhythm, and generates the next open occurrence once a routine is done.

import { prisma } from "@/lib/db";
import { PrismaClient, Task } from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Per-rhythm offsets in days. Unknown rhythms default to weekly (+7 days). */
const RHYTHM_OFFSET_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  "2x-week": 3,
};

const DEFAULT_OFFSET_DAYS = 7;

/**
 * Returns a *new* `Date` advanced from `from` by the offset for `rhythm`
 * (`"daily"` → +1, `"weekly"` → +7, `"biweekly"` → +14, `"2x-week"` → +3).
 * Unknown/unsupported rhythms default to +7 days (weekly).
 *
 * Pure — does not mutate `from`, has no DB dependency.
 */
export function nextDueDate(rhythm: string, from: Date): Date {
  const offsetDays = RHYTHM_OFFSET_DAYS[rhythm] ?? DEFAULT_OFFSET_DAYS;
  return new Date(from.getTime() + offsetDays * DAY_MS);
}

/**
 * Generates the next open occurrence of a done routine task, or `null` when:
 * - the task isn't a `"routine"` with a non-empty `rhythm`, or
 * - the task isn't `status === "done"`, or
 * - a successor already exists (an open Task sharing the recurrence chain
 *   with a later `dueDate`) — preventing duplicates on repeated calls.
 *
 * The successor copies the routine's plan-relevant fields, resets
 * `assignedToId = null` (so the engine can re-plan it fairly), and is linked
 * via `recurringParentId = task.recurringParentId ?? task.id`.
 */
export async function generateNextOccurrence(
  taskId: string,
  client: PrismaClient = prisma,
): Promise<Task | null> {
  const task = await client.task.findUnique({ where: { id: taskId } });
  if (!task) return null;

  if (task.type !== "routine" || !task.rhythm || task.status !== "done") {
    return null;
  }

  const chainId = task.recurringParentId ?? task.id;

  const existingSuccessor = await client.task.findFirst({
    where: {
      recurringParentId: chainId,
      status: "open",
      dueDate: { gt: task.dueDate },
    },
  });
  if (existingSuccessor) return null;

  return client.task.create({
    data: {
      title: task.title,
      type: task.type,
      effort: task.effort,
      allowedPersons: task.allowedPersons,
      outdoor: task.outdoor,
      weatherCondition: task.weatherCondition,
      icon: task.icon,
      rhythm: task.rhythm,
      projectId: task.projectId,
      assignedToId: null,
      status: "open",
      recurringParentId: chainId,
      dueDate: nextDueDate(task.rhythm, task.dueDate),
    },
  });
}
