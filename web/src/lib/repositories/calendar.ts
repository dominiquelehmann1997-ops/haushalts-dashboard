// Repository for synced calendar events.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Appointment, PersonKey } from "@/lib/domain";
import type { BusyWindow, PersonKey as EnginePersonKey } from "@/lib/engine/types";
import type { CalendarEventInput } from "@/integrations/calendar/google";
import { dayBounds, formatTime } from "@/lib/dates";

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

/**
 * Upserts each `CalendarEventInput` by its `externalId` — creates a new
 * `CalendarEvent` row if none exists for that external ID, otherwise updates
 * the existing row's fields. Used by the Google Calendar sync (Phase 4) to
 * write fetched events into the DB without duplicating across syncs.
 */
export async function upsertEvents(
  events: CalendarEventInput[],
  client: PrismaClient = prisma,
): Promise<void> {
  for (const event of events) {
    const data = {
      calendarKey: event.calendarKey,
      title: event.title,
      start: event.start,
      end: event.end,
      personKey: event.personKey,
      kind: event.kind,
      place: event.place,
    };

    await client.calendarEvent.upsert({
      where: { externalId: event.externalId },
      create: { externalId: event.externalId, ...data },
      update: data,
    });
  }
}

/**
 * `CalendarEvent` rows in `[from, to]` (overlap, not containment — `start <=
 * to AND end >= from`) whose `personKey` is `"dome"`/`"emely"`, mapped to the
 * engine's `BusyWindow[]` (`@/lib/engine/types`). Family/baby events (no
 * person, or `personKey: "baby"`) are excluded — they don't constrain a
 * person's availability for planning.
 */
export async function getBusyWindows(
  from: Date,
  to: Date,
  client: PrismaClient = prisma,
): Promise<BusyWindow[]> {
  const rows = await client.calendarEvent.findMany({
    where: {
      personKey: { in: ["dome", "emely"] },
      start: { lte: to },
      end: { gte: from },
    },
    orderBy: { start: "asc" },
  });

  return rows.map((row) => ({
    person: row.personKey as EnginePersonKey,
    start: row.start,
    end: row.end,
  }));
}
