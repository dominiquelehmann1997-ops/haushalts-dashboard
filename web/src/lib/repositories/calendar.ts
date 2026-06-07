// Repository for synced calendar events.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Appointment, PersonKey } from "@/lib/domain";

/** Returns the local-day [start, end] bounds (00:00:00.000 → 23:59:59.999) for `date`. */
function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/** Formats a Date as a zero-padded 24h "HH:MM" local time string. */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * CalendarEvents whose `start` falls on the given local day, ordered by start time.
 *
 * `who` is derived as `personKey ? [personKey] : []`, with `"baby"` appended
 * when `kind === "baby-arzt"`.
 */
export async function getTodaysEvents(
  date: Date,
  client: PrismaClient = prisma,
): Promise<Appointment[]> {
  const { start, end } = dayBounds(date);

  const rows = await client.calendarEvent.findMany({
    where: { start: { gte: start, lte: end } },
    orderBy: { start: "asc" },
  });

  return rows.map((row) => {
    const who: PersonKey[] = [];
    if (row.personKey) who.push(row.personKey as PersonKey);
    if (row.kind === "baby-arzt") who.push("baby");

    return {
      id: row.id,
      time: formatTime(row.start),
      title: row.title,
      place: row.place ?? "",
      who,
    };
  });
}
