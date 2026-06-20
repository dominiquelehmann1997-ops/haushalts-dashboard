// GET|POST /api/sync/calendar — pulls the next 14 days from each configured
// Google Calendar and upserts them into `CalendarEvent` via the shared
// `syncCalendar` service. Read-only towards Google. "Not connected"/network
// errors become a clean JSON error rather than crashing.

import { NextResponse } from "next/server";

import { configuredCalendars, syncCalendar } from "@/lib/services/calendarSync";

async function runSync() {
  const calendars = configuredCalendars();

  if (calendars.length === 0) {
    return NextResponse.json(
      { error: "No calendars configured — set GOOGLE_CALENDAR_DOME/EMELY/FAMILY/DOME_DIENSTPLAN/DOME_VEREIN/GEBURTSTAGE (see docs/setup/google-calendar.md)." },
      { status: 400 },
    );
  }

  try {
    const result = await syncCalendar(calendars);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Calendar sync failed" },
      { status: 502 },
    );
  }
}

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}
