// Shared local-time date helpers used across repositories (and later the
// engine/services). Kept in one place so the week/day boundary rules can't
// drift between call sites.

/** Returns the Monday 00:00 → Sunday 23:59:59.999 bounds of the current local ISO week. */
export function currentWeekBounds(): { start: Date; end: Date } {
  return weekBoundsOf(new Date());
}

/** Returns the local-day [start, end] bounds (00:00:00.000 → 23:59:59.999) for `date`. */
export function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/** Formats a Date as a zero-padded 24h "HH:MM" local time string. */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Returns a new Date offset by `days` calendar days, local midnight preserved. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Returns local midnight on the Monday of the ISO week containing `date`. */
export function mondayOf(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  const dayOfWeek = monday.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diffToMonday);
  return monday;
}

/** Returns the Monday 00:00 → Sunday 23:59:59.999 bounds of the local ISO week containing `date`. */
export function weekBoundsOf(date: Date): { start: Date; end: Date } {
  const start = mondayOf(date);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Stable local-day key "YYYY-M-D" (no padding) for map lookups by calendar day.
 * @example localDateKey(new Date(2026, 5, 9)) // "2026-6-9"
 */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Local midnight on the Monday of the ISO week `offset` weeks away from the week
 * containing `from` (0 = current week, 1 = next week, -1 = last week). Basis der
 * Vorausplanung: alle Essensplan-Aktionen nehmen einen `weekStart` entgegen.
 */
export function weekStartWithOffset(offset: number, from: Date = new Date()): Date {
  return addDays(mondayOf(from), offset * 7);
}

/**
 * Anzahl ganzer ISO-Wochen zwischen der Woche um `from` und der Woche um `date`
 * (0 = dieselbe Woche, 1 = die Woche danach). Umkehrung von `weekStartWithOffset`.
 */
export function weekOffsetOf(date: Date, from: Date = new Date()): number {
  const diffMs = mondayOf(date).getTime() - mondayOf(from).getTime();
  // round statt floor: robust gegen DST-bedingte 23/25-Stunden-Tage.
  return Math.round(diffMs / (7 * 86_400_000));
}

/** Kompakte Wochenspanne "25.8. – 31.8." für die Woche um `date`. */
export function formatWeekRange(date: Date): string {
  const { start } = weekBoundsOf(date);
  const end = addDays(start, 6);
  const day = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
  return `${day(start)} – ${day(end)}`;
}

/** Menschliche Wochen-Bezeichnung: "Diese Woche" / "Nächste Woche" / "in 2 Wochen". */
export function weekOffsetLabel(offset: number): string {
  if (offset === 0) return "Diese Woche";
  if (offset === 1) return "Nächste Woche";
  if (offset === -1) return "Letzte Woche";
  return offset > 0 ? `In ${offset} Wochen` : `Vor ${Math.abs(offset)} Wochen`;
}
