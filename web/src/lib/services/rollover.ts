// Rollover service: pushes unfinished standalone tasks from one day to the next.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { dayBounds } from "@/lib/dates";

/**
 * Moves standalone tasks (`projectId == null`) with `status` `"open"` or
 * `"moved"` whose `dueDate` falls on `fromDay` to `toDay` (sets `dueDate = toDay`).
 * `"done"` / `"failed"` tasks are left untouched.
 *
 * Returns the number of tasks updated.
 */
export async function rolloverOpenTasks(
  fromDay: Date,
  toDay: Date,
  client: PrismaClient = prisma,
): Promise<number> {
  const { start, end } = dayBounds(fromDay);

  const result = await client.task.updateMany({
    where: {
      projectId: null,
      status: { in: ["open", "moved"] },
      dueDate: { gte: start, lte: end },
    },
    data: {
      dueDate: toDay,
    },
  });

  return result.count;
}
