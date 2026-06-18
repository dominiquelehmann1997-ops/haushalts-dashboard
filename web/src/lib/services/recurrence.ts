// Recurrence service: computes the next due date for a recurring task's
// rhythm, and generates the next open occurrence once a routine is done.

import { prisma } from "@/lib/db";
import { PrismaClient, Task } from "@/generated/prisma/client";
import { learnedInterval } from "@/lib/services/learnedInterval";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;

/** Real completion gaps (in days) for a routine chain, oldest → newest. */
async function chainCompletionGaps(chainId: string, client: PrismaClient): Promise<number[]> {
  const done = await client.task.findMany({
    where: {
      OR: [{ recurringParentId: chainId }, { id: chainId }],
      status: "done",
      completedAt: { not: null },
    },
    orderBy: { completedAt: "asc" },
    select: { completedAt: true },
  });
  const gaps: number[] = [];
  for (let i = 1; i < done.length; i++) {
    const prev = done[i - 1]!.completedAt!.getTime();
    const cur = done[i]!.completedAt!.getTime();
    gaps.push((cur - prev) / DAY_MS_LOCAL);
  }
  return gaps;
}

/** Per-rhythm offsets in days. Unknown rhythms default to weekly (+7 days). */
const RHYTHM_OFFSET_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  "2x-week": 3,
  "3-day": 3,
  "5-day": 5,
};

/** Rhythms advanced by whole calendar months (no day-count drift). */
const RHYTHM_MONTHS: Record<string, number> = {
  monthly: 1,
  halfyearly: 6,
};

const DEFAULT_OFFSET_DAYS = 7;

/**
 * Returns a *new* `Date` advanced from `from` by the offset for `rhythm`.
 * Day-based rhythms (`daily`/`weekly`/`biweekly`/`2x-week`/`3-day`/`5-day`)
 * add a fixed number of days; month-based rhythms (`monthly`/`halfyearly`)
 * advance whole calendar months via `setMonth` (so 12th -> 12th, no drift).
 * Unknown/unsupported rhythms default to +7 days (weekly).
 *
 * Note: `setMonth` rolls over for shorter months (31 Jan + 1 month -> 3 Mar);
 * acceptable for household chores.
 *
 * Pure — does not mutate `from`, has no DB dependency.
 */
export function nextDueDate(rhythm: string, from: Date): Date {
  const months = RHYTHM_MONTHS[rhythm];
  if (months !== undefined) {
    const result = new Date(from);
    result.setMonth(result.getMonth() + months);
    return result;
  }

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

  // Interval restart: count from when it was actually done, not the old plan date.
  const base = task.completedAt ?? task.dueDate;

  const learned = learnedInterval(await chainCompletionGaps(chainId, client));
  const nextDue =
    learned != null
      ? new Date(base.getTime() + Math.round(learned) * DAY_MS_LOCAL)
      : nextDueDate(task.rhythm, base);

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
      dueDate: nextDue,
    },
  });
}
