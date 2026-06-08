// GET|POST /api/sync/calendar — pulls the next 14 days of events from each
// configured Google Calendar (GOOGLE_CALENDAR_DOME/EMELY/FAMILY/
// DOME_DIENSTPLAN/DOME_VEREIN/GEBURTSTAGE → calendar keys "dome"/"emely"/
// "family"/"dome_dienstplan"/"dome_verein"/"geburtstage"; calendars whose env
// var is unset are skipped) and upserts them into `CalendarEvent`
// (`@/lib/repositories/calendar`'s `upsertEvents`). Once synced, the
// appointments tile (`getTodaysEvents`) picks them up automatically — no
// further wiring needed.
//
// Read-only: never writes back to Google. "Not connected" (no stored OAuth
// token) is reported as a clear JSON error rather than crashing.

import { NextResponse } from "next/server";

import { fetchEvents, type CalendarEventInput } from "@/integrations/calendar/google";
import { upsertEvents } from "@/lib/repositories/calendar";

const SYNC_WINDOW_DAYS = 14;

/** Maps each calendar's env var to its `calendarKey`; entries with no env value are skipped. */
function configuredCalendars(): { calendarId: string; calendarKey: string }[] {
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

async function runSync() {
  const calendars = configuredCalendars();

  if (calendars.length === 0) {
    return NextResponse.json(
      { error: "No calendars configured — set GOOGLE_CALENDAR_DOME/EMELY/FAMILY/DOME_DIENSTPLAN/DOME_VEREIN/GEBURTSTAGE (see docs/setup/google-calendar.md)." },
      { status: 400 },
    );
  }

  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + SYNC_WINDOW_DAYS);

  let allEvents: CalendarEventInput[] = [];

  try {
    for (const { calendarId, calendarKey } of calendars) {
      const events = await fetchEvents(calendarId, calendarKey, from, to);
      allEvents = allEvents.concat(events);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Calendar sync failed" },
      { status: 502 },
    );
  }

  await upsertEvents(allEvents);

  return NextResponse.json({ synced: allEvents.length });
}

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}
