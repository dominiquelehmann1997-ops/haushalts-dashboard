// Pure shift-time corrections for Dome's "Nacht"/"LN" calendar entries.
//
// These overnight shifts are entered in the calendar ending 23:59 on their
// start day, but actually run until 05:30 the next morning, after which Dome
// sleeps until ~14:00. Both the remaining shift and the sleep that follows
// keep Dome unavailable, so they form one continuous busy block ending at
// 14:00 the next day.
//
// Pure (no db/next/prisma) — mirrors the engine/integration "pure mapper +
// unit test" pattern. Consumed by `getBusyWindows` in
// `@/lib/repositories/calendar`.

/** Hour Dome is available again after an overnight shift's following sleep. */
const WAKE_HOUR = 14;

/** Exact event titles (lowercased) that denote an overnight shift. */
const OVERNIGHT_SHIFT_TITLES = new Set(["nacht", "ln"]);

/**
 * True when `title` is exactly an overnight shift — "Nacht" or "LN",
 * case-insensitive and trimmed. Matches the whole title (not a substring), so
 * "Nachtisch"/"Nachtschicht" do not qualify.
 */
export function isOvernightShift(title: string): boolean {
  return OVERNIGHT_SHIFT_TITLES.has(title.trim().toLowerCase());
}

/**
 * The real end of an overnight shift's busy block: the shift runs to 05:30 the
 * day after it starts, immediately followed by sleep until 14:00 — one
 * continuous unavailable window. Returns 14:00 (local) on the day after
 * `start`'s local day.
 */
export function correctedBusyEnd(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(WAKE_HOUR, 0, 0, 0);
  return end;
}
