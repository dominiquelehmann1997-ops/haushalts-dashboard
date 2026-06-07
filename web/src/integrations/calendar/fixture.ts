// Realistic captured-shape Google Calendar `events.list` response items, used
// as a fixture for the pure mapper tests (`mapGoogleEvents`). No network.
//
// Covers:
// - a timed event (`start.dateTime`/`end.dateTime`, with a `location`)
// - an all-day event (`start.date`/`end.date`, no time component)
// - a "U4-Untersuchung" timed event → should map to `kind: "baby-arzt"`
//   via the medical/baby heuristic
// - a cancelled event (`status: "cancelled"`) → should be skipped entirely
//
// Shape mirrors the real Calendar API v3 `events.list` `items[]` entries
// (only the fields `mapGoogleEvents` reads are populated).
export const googleEventsFixture: unknown[] = [
  {
    kind: "calendar#event",
    id: "evt-sport-001",
    status: "confirmed",
    summary: "Sport",
    location: "Verein",
    start: { dateTime: "2026-06-07T18:30:00+02:00", timeZone: "Europe/Berlin" },
    end: { dateTime: "2026-06-07T20:00:00+02:00", timeZone: "Europe/Berlin" },
  },
  {
    kind: "calendar#event",
    id: "evt-geburtstag-002",
    status: "confirmed",
    summary: "Omas Geburtstag",
    start: { date: "2026-06-10" },
    end: { date: "2026-06-11" },
  },
  {
    kind: "calendar#event",
    id: "evt-u4-003",
    status: "confirmed",
    summary: "U4-Untersuchung",
    location: "Kinderarzt Dr. Müller",
    start: { dateTime: "2026-06-08T11:00:00+02:00", timeZone: "Europe/Berlin" },
    end: { dateTime: "2026-06-08T12:00:00+02:00", timeZone: "Europe/Berlin" },
  },
  {
    kind: "calendar#event",
    id: "evt-cancelled-004",
    status: "cancelled",
    summary: "Abgesagter Termin",
    start: { dateTime: "2026-06-09T09:00:00+02:00", timeZone: "Europe/Berlin" },
    end: { dateTime: "2026-06-09T10:00:00+02:00", timeZone: "Europe/Berlin" },
  },
];
