// Repository for synced calendar events.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Appointment, PersonKey } from "@/lib/domain";
import type { BusyWindow } from "@/lib/engine/types";
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
 * to AND end >= from`) that constrain someone's availability, mapped to the
 * engine's `BusyWindow[]` (`@/lib/engine/types`):
 *
 * - Rows with `personKey` `"dome"`/`"emely"` become one window for that person.
 * - Family-calendar rows (`calendarKey === "family"`, no `personKey` — events
 *   entered there apply to both) become one window each for `"dome"` and
 *   `"emely"`.
 *
 * Other events without a person (e.g. birthdays) and baby events
 * (`personKey: "baby"`) are excluded — they don't constrain availability.
 */
export async function getBusyWindows(
  from: Date,
  to: Date,
  client: PrismaClient = prisma,
): Promise<BusyWindow[]> {
  const rows = await client.calendarEvent.findMany({
    where: {
      OR: [{ personKey: { in: ["dome", "emely"] } }, { calendarKey: "family" }],
      start: { lte: to },
      end: { gte: from },
    },
    orderBy: { start: "asc" },
  });

  const windows: BusyWindow[] = [];
  for (const row of rows) {
    if (row.personKey === "dome" || row.personKey === "emely") {
      windows.push({ person: row.personKey, start: row.start, end: row.end });
    } else if (row.calendarKey === "family") {
      windows.push({ person: "dome", start: row.start, end: row.end });
      windows.push({ person: "emely", start: row.start, end: row.end });
    }
  }

  return windows;
}
