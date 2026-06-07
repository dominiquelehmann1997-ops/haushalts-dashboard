// Repository for the points-based "Konto" / weekly split.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";

/**
 * Sums `AccountEntry.points` per person ("dome" | "emely") for entries whose
 * `occurredAt` falls within the current ISO week (Monday 00:00 → Sunday 23:59 local).
 */
export async function getWeeklyBalances(
  client: PrismaClient = prisma,
): Promise<{ dome: number; emely: number }> {
  const { start, end } = currentWeekBounds();

  const entries = await client.accountEntry.findMany({
    where: { occurredAt: { gte: start, lte: end } },
    include: { person: true },
  });

  let dome = 0;
  let emely = 0;
  for (const entry of entries) {
    if (entry.person.key === "dome") dome += entry.points;
    else if (entry.person.key === "emely") emely += entry.points;
  }

  return { dome, emely };
}

/**
 * Integer percentages derived from the current week's balances (sum ~100).
 * Returns `{ dome: 0, emely: 0 }` when the total is 0.
 */
export async function getComputedSplit(
  client: PrismaClient = prisma,
): Promise<{ dome: number; emely: number }> {
  const { dome, emely } = await getWeeklyBalances(client);
  const total = dome + emely;

  if (total === 0) {
    return { dome: 0, emely: 0 };
  }

  return {
    dome: Math.round((dome / total) * 100),
    emely: Math.round((emely / total) * 100),
  };
}
