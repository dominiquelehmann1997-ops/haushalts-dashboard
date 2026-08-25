// Repository for synced calendar events.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Appointment, PersonKey } from "@/lib/domain";
import type { BusyWindow } from "@/lib/engine/types";
import type { CalendarEventInput } from "@/integrations/calendar/google";
import { correctedBusyEnd, isOvernightShift } from "@/lib/calendar/shifts";
import { dayBounds, formatTime, weekBoundsOf } from "@/lib/dates";

/**
 * `true` nur für den exakten Titel "Urlaub" (getrimmt, Groß-/Kleinschreibung
 * egal) — bedeutet dienstfrei, aber zuhause. Bewusst KEIN Präfix-/Teilmatch:
 * "Urlaub Pinnow" (verreist) ist absichtlich `false`.
 */
function isUrlaubFrei(title: string): boolean {
  return title.trim().toLowerCase() === "urlaub";
}

/** `calendarKey` des eigenen Geburtstagskalenders (siehe `configuredCalendars`). */
const BIRTHDAY_CALENDAR_KEY = "geburtstage";

/** Kuchen-Emoji am Titelanfang — die Markierung für Geburtstage außerhalb des Geburtstagskalenders. */
const BIRTHDAY_MARKER = "🎂";

/**
 * `true` für Geburtstage — entweder aus dem eigenen Geburtstagskalender
 * (dort zählt *jeder* Eintrag) oder mit einem Kuchen-Emoji am Titelanfang
 * markiert.
 */
function isBirthday(title: string, calendarKey: string): boolean {
  return calendarKey === BIRTHDAY_CALENDAR_KEY || title.trimStart().startsWith(BIRTHDAY_MARKER);
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
      time: row.allDay ? "ganztägig" : formatTime(row.start),
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
      allDay: event.allDay,
    };

    await client.calendarEvent.upsert({
      where: { externalId: event.externalId },
      create: { externalId: event.externalId, ...data },
      update: data,
    });
  }
}

/**
 * Persists a freshly fetched sync window: upserts every event, then deletes
 * any `CalendarEvent` overlapping `[from, to]` whose `externalId` was **not**
 * in the fetched set.
 *
 * The delete is what makes removals/reschedules in Google Calendar actually
 * propagate. `upsertEvents` alone only ever creates or updates rows, so an
 * event deleted (or moved out of the window) upstream lingers in the DB
 * forever and keeps showing on the dashboard. By treating each sync as the
 * authoritative snapshot of its window, anything no longer present upstream is
 * pruned.
 *
 * Scoped to `[from, to]` so events outside the synced range are untouched.
 * Overlap (`start <= to AND end >= from`) mirrors Google's `timeMin`/`timeMax`
 * semantics, so the kept set is exactly what the fetch could have returned.
 *
 * When `events` is empty (the window genuinely has no events upstream) the
 * `notIn` filter is dropped so the whole window is cleared — `notIn: []` would
 * otherwise match nothing in Prisma.
 */
export async function replaceWindowEvents(
  events: CalendarEventInput[],
  window: { from: Date; to: Date },
  client: PrismaClient = prisma,
): Promise<{ deleted: number }> {
  await upsertEvents(events, client);

  const keep = events.map((e) => e.externalId);
  const { count } = await client.calendarEvent.deleteMany({
    where: {
      start: { lte: window.to },
      end: { gte: window.from },
      ...(keep.length > 0 ? { externalId: { notIn: keep } } : {}),
    },
  });

  return { deleted: count };
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
 * Other events without a person and baby events (`personKey: "baby"`) are
 * excluded — they don't constrain availability.
 *
 * Geburtstage sind ebenfalls ausgenommen, auch wenn sie in einem persönlichen
 * oder im Familienkalender stehen: Einträge aus dem Geburtstagskalender
 * (`calendarKey: "geburtstage"`) sowie alles mit Kuchen-Emoji am Titelanfang.
 * Sie stehen ganztägig im Kalender, kosten aber keine Zeit — sonst wäre der
 * ganze Tag als belegt gewertet und es würden keine Aufgaben verteilt.
 * Angezeigt werden sie trotzdem (`getTodaysEvents` filtert nicht).
 *
 * Dome's overnight shifts ("Nacht"/"LN") are entered ending 23:59 on their
 * start day but actually keep Dome busy (shift + following sleep) until 14:00
 * the next day (see `@/lib/calendar/shifts`). Their window end is corrected
 * accordingly. Because such a shift starting the day *before* `from` still
 * constrains the requested range, the fetch looks back one extra day, then
 * windows that don't actually overlap `[from, to]` are dropped — which also
 * discards unrelated previous-day events pulled in by that look-back.
 */
export async function getBusyWindows(
  from: Date,
  to: Date,
  client: PrismaClient = prisma,
): Promise<BusyWindow[]> {
  const lookbackFrom = new Date(from);
  lookbackFrom.setDate(lookbackFrom.getDate() - 1);

  const rows = await client.calendarEvent.findMany({
    where: {
      OR: [{ personKey: { in: ["dome", "emely"] } }, { calendarKey: "family" }],
      start: { lte: to },
      end: { gte: lookbackFrom },
    },
    orderBy: { start: "asc" },
  });

  const windows: BusyWindow[] = [];
  for (const row of rows) {
    // Ganztägiger "Urlaub" (genau dieser Titel) = dienstfrei, aber zuhause →
    // blockiert NICHT die Aufgabenverteilung. "Urlaub Pinnow" o.Ä. (verreist)
    // bleibt ein normaler ganztägiger Block.
    if (row.allDay && isUrlaubFrei(row.title)) continue;

    // Geburtstage stehen ganztägig im Kalender, kosten aber keine Zeit →
    // blockieren NICHT die Aufgabenverteilung. Sie bleiben auf dem Dashboard
    // sichtbar, weil `getTodaysEvents` alle Events unverändert anzeigt.
    if (isBirthday(row.title, row.calendarKey)) continue;

    if (row.personKey === "dome" || row.personKey === "emely") {
      const end =
        row.personKey === "dome" && isOvernightShift(row.title)
          ? correctedBusyEnd(row.start)
          : row.end;
      windows.push({ person: row.personKey, start: row.start, end });
    } else if (row.calendarKey === "family") {
      windows.push({ person: "dome", start: row.start, end: row.end });
      windows.push({ person: "emely", start: row.start, end: row.end });
    }
  }

  return windows.filter((w) => w.start <= to && w.end >= from);
}

/**
 * True, wenn für die Woche um `weekStart` überhaupt Kalendertermine in der DB
 * liegen. Der Sync holt nur ein 14-Tage-Fenster (siehe `calendarSync`) — bei der
 * Vorausplanung weiter entfernter Wochen wäre der Dienstplan sonst unbemerkt
 * blind, und der Essensplan verlöre seine dienstbewussten Constraints.
 */
export async function hasCalendarDataForWeek(
  weekStart: Date,
  client: PrismaClient = prisma,
): Promise<boolean> {
  const { start, end } = weekBoundsOf(weekStart);
  const count = await client.calendarEvent.count({
    where: { start: { gte: start, lte: end } },
  });
  return count > 0;
}
