// Sync-Kern: zieht die nächsten 14 Tage aus den konfigurierten Google-Kalendern
// und upsertet sie in `CalendarEvent`. Gemeinsam genutzt von der HTTP-Route,
// dem CLI-Script (`prisma/syncCalendar.ts`) und der Server-Action.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { fetchEvents, type CalendarEventInput } from "@/integrations/calendar/google";
import { replaceWindowEvents } from "@/lib/repositories/calendar";

const SYNC_WINDOW_DAYS = 14;

export type EventFetcher = (
  calendarId: string,
  calendarKey: string,
  from: Date,
  to: Date,
) => Promise<CalendarEventInput[]>;

/** Mappt jede Kalender-Env-Var auf ihren `calendarKey`; Einträge ohne Wert werden übersprungen. */
export function configuredCalendars(): { calendarId: string; calendarKey: string }[] {
  const candidates: { calendarKey: string; calendarId: string | undefined }[] = [
    { calendarKey: "dome", calendarId: process.env.GOOGLE_CALENDAR_DOME },
    { calendarKey: "emely", calendarId: process.env.GOOGLE_CALENDAR_EMELY },
    { calendarKey: "family", calendarId: process.env.GOOGLE_CALENDAR_FAMILY },
    { calendarKey: "dome_dienstplan", calendarId: process.env.GOOGLE_CALENDAR_DOME_DIENSTPLAN },
    { calendarKey: "dome_verein", calendarId: process.env.GOOGLE_CALENDAR_DOME_VEREIN },
    { calendarKey: "geburtstage", calendarId: process.env.GOOGLE_CALENDAR_GEBURTSTAGE },
  ];

  return candidates
    .filter((c): c is { calendarKey: string; calendarId: string } => Boolean(c.calendarId))
    .map((c) => ({ calendarId: c.calendarId, calendarKey: c.calendarKey }));
}

/**
 * Zieht je Kalender das Sync-Fenster (ab Mitternacht heute bis +14 Tage) und
 * schreibt es als maßgeblichen Snapshot in die DB: vorhandene Termine werden
 * geupsertet, im Fenster gelöschte/verschobene Termine werden entfernt
 * (`replaceWindowEvents`) — so verschwinden in Google gelöschte Termine auch
 * im Dashboard, statt hängen zu bleiben.
 *
 * Das Fenster beginnt bewusst um Mitternacht (nicht „jetzt"), damit der ganze
 * heutige Tag immer vollständig geholt und konsistent geprunt wird — sonst
 * würden bereits vergangene Termine des Tages aus dem Fenster fallen und beim
 * Pruning gelöscht.
 *
 * Wirft bei Netz-/Auth-Fehlern (aus `fetchEvents`) **bevor** gepruned wird —
 * der Caller entscheidet über Status/Degradation; bei einem Teil-Fehler bleibt
 * die DB unangetastet. `deps.fetch`/`deps.client` sind für Tests injizierbar.
 */
export async function syncCalendar(
  calendars: { calendarId: string; calendarKey: string }[] = configuredCalendars(),
  deps: { fetch?: EventFetcher; client?: PrismaClient } = {},
): Promise<{ synced: number; deleted: number }> {
  const { fetch = fetchEvents, client = prisma } = deps;

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + SYNC_WINDOW_DAYS);

  let all: CalendarEventInput[] = [];
  for (const { calendarId, calendarKey } of calendars) {
    const events = await fetch(calendarId, calendarKey, from, to);
    all = all.concat(events);
  }

  const { deleted } = await replaceWindowEvents(all, { from, to }, client);
  return { synced: all.length, deleted };
}
