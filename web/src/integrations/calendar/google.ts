// Google Calendar integration (Phase 4) — read-only sync of `CalendarEvent`
// rows from Google Calendar's REST `events.list` endpoint.
//
// Split into a pure mapper (network/env-free, unit-tested with a fixture) and
// a thin network wrapper (not unit-tested — would hit the network), mirroring
// `@/integrations/weather/openMeteo`.
//
// `mapGoogleEvents` produces `CalendarEventInput[]`, the shape the calendar
// repository's `upsertEvents` (`@/lib/repositories/calendar`) persists.

import { getAccessToken } from "./googleAuth";

/** Input shape for `upsertEvents` — matches the `CalendarEvent` model's writable fields. */
export interface CalendarEventInput {
  externalId: string;
  calendarKey: string;
  title: string;
  start: Date;
  end: Date;
  personKey: string | null;
  kind: "termin" | "baby-arzt";
  place: string | null;
  allDay: boolean;
}

/** Shape of a single raw Google Calendar `events.list` `items[]` entry (the fields we use). */
interface GoogleEventTime {
  dateTime?: string; // RFC3339 timestamp, timed events
  date?: string; // "YYYY-MM-DD", all-day events
}

interface GoogleEvent {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
}

/** Case-insensitive heuristic for baby/medical appointments → `kind: "baby-arzt"`. */
const BABY_ARZT_PATTERN = /U\d|Kinderarzt|Hebamme|U-Untersuchung|Vorsorge|Impf/i;

/**
 * Parses a Google `start`/`end` time object into a `Date`.
 *
 * Timed events carry `dateTime` (an RFC3339 timestamp with offset — `new
 * Date` parses it directly). All-day events carry `date` ("YYYY-MM-DD"); we
 * parse it as a local-midnight date (matching `dayBounds`'s local-day
 * semantics) rather than letting `new Date("YYYY-MM-DD")` interpret it as UTC
 * midnight, which would shift the day in non-UTC timezones.
 */
function parseEventTime(time: GoogleEventTime | undefined): Date {
  if (time?.dateTime) {
    return new Date(time.dateTime);
  }
  if (time?.date) {
    const [year, month, day] = time.date.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  throw new Error("Google Calendar event is missing both start.dateTime and start.date");
}

/**
 * Derives `personKey` from `calendarKey` by prefix: keys starting with
 * `"dome"`/`"emely"` (e.g. `"dome_dienstplan"`, `"dome_verein"`) belong to
 * that person; anything else (e.g. `"family"`, `"geburtstage"`) is `null`.
 */
function derivePersonKey(calendarKey: string): string | null {
  if (calendarKey.startsWith("dome")) return "dome";
  if (calendarKey.startsWith("emely")) return "emely";
  return null;
}

/** Classifies an event's `kind` from its title via the baby/medical heuristic. */
function deriveKind(title: string): "termin" | "baby-arzt" {
  return BABY_ARZT_PATTERN.test(title) ? "baby-arzt" : "termin";
}

/**
 * Maps raw Google Calendar `events.list` `items[]` entries into
 * `CalendarEventInput[]` — pure, no network/env access.
 *
 * - `externalId` is prefixed with `calendarKey` (`"${calendarKey}:${id}"`) so
 *   IDs stay unique across calendars (the same event can be visible — with
 *   the same Google event `id` — on multiple calendars, e.g. a shared family
 *   event also showing on a personal calendar).
 * - Handles both timed (`start.dateTime`) and all-day (`start.date`) events.
 * - `personKey` is derived from `calendarKey` by prefix (keys starting with
 *   `"dome"`/`"emely"` → that person, else `null`, e.g. `"family"`/`"geburtstage"`).
 * - `kind` is `"baby-arzt"` when the title matches the medical/baby
 *   heuristic (case-insensitive `U\d`, `Kinderarzt`, `Hebamme`,
 *   `U-Untersuchung`, `Vorsorge`, `Impf`), else `"termin"`.
 * - `place` is Google's `location`, or `null`.
 * - `allDay` is `true` for all-day events (Google carries `start.date`, not
 *   `start.dateTime`).
 * - Cancelled events (`status === "cancelled"`) are skipped entirely.
 */
export function mapGoogleEvents(rawItems: unknown[], calendarKey: string): CalendarEventInput[] {
  const events: CalendarEventInput[] = [];

  for (const raw of rawItems) {
    const item = raw as GoogleEvent;

    if (item.status === "cancelled") continue;
    if (!item.id) continue;

    const title = item.summary ?? "";

    events.push({
      externalId: `${calendarKey}:${item.id}`,
      calendarKey,
      title,
      start: parseEventTime(item.start),
      end: parseEventTime(item.end),
      personKey: derivePersonKey(calendarKey),
      kind: deriveKind(title),
      place: item.location ?? null,
      allDay: item.start?.date != null,
    });
  }

  return events;
}

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/** Formats a `Date` as an RFC3339 timestamp (`timeMin`/`timeMax` expect this). */
function toRfc3339(date: Date): string {
  return date.toISOString();
}

/**
 * Fetches events for `calendarId` in `[from, to]` and maps them to
 * `CalendarEventInput[]` via `mapGoogleEvents`. NOT unit-tested (network I/O)
 * — `mapGoogleEvents` carries the tested logic.
 *
 * Uses `singleEvents=true` (expands recurring events into instances) and
 * `orderBy=startTime`, matching the Calendar API's recommended read pattern
 * for a flat, chronological event list.
 *
 * Throws on a non-OK response or when not connected (`getAccessToken` throws)
 * — the caller (the sync route) decides how to report/degrade.
 */
export async function fetchEvents(
  calendarId: string,
  calendarKey: string,
  from: Date,
  to: Date,
): Promise<CalendarEventInput[]> {
  const accessToken = await getAccessToken();

  const params = new URLSearchParams({
    timeMin: toRfc3339(from),
    timeMax: toRfc3339(to),
    singleEvents: "true",
    orderBy: "startTime",
  });

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const reason = await response
      .json()
      .then((body: { error?: { message?: string; errors?: { reason?: string }[] } }) => {
        const detail = body.error?.errors?.[0]?.reason;
        const message = body.error?.message;
        return [detail, message].filter(Boolean).join(": ");
      })
      .catch(() => undefined);

    throw new Error(
      `Google Calendar request failed for "${calendarKey}" (${calendarId}): ${response.status} ${response.statusText}` +
        (reason ? ` — ${reason}` : ""),
    );
  }

  const body = (await response.json()) as { items?: unknown[] };
  return mapGoogleEvents(body.items ?? [], calendarKey);
}
