// Pure Tageskapazität: welcher Anteil des "aktiven Tages" (08:00–22:00) ist pro
// Person durch BusyWindows (Termine/Schichten, inkl. Nacht→14:00-Korrektur aus
// @/lib/repositories/calendar) belegt. Kein db/next/prisma — Engine-Pure-Regel.

import type { BusyWindow, PersonKey } from "./types";

const ACTIVE_START_HOUR = 8;
const ACTIVE_END_HOUR = 22;
const PERSONS: PersonKey[] = ["dome", "emely"];

/** Lokales 08:00–22:00-Fenster des `day`. */
export function activeDayWindow(day: Date): { start: Date; end: Date } {
  const start = new Date(day);
  start.setHours(ACTIVE_START_HOUR, 0, 0, 0);
  const end = new Date(day);
  end.setHours(ACTIVE_END_HOUR, 0, 0, 0);
  return { start, end };
}

/** Summe der auf `window` geclippten, gemergten Intervall-Längen (ms). */
function coveredMs(
  windows: { start: Date; end: Date }[],
  window: { start: Date; end: Date },
): number {
  const clipped = windows
    .map((w) => ({
      start: Math.max(w.start.getTime(), window.start.getTime()),
      end: Math.min(w.end.getTime(), window.end.getTime()),
    }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const w of clipped) {
    if (w.start > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = w.start;
      curEnd = w.end;
    } else {
      curEnd = Math.max(curEnd, w.end);
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

/**
 * Belegungsanteil 0…1 pro Person über `window`. Überlappende Fenster werden
 * gemerged (keine Doppelzählung), auf `window` geclippt. Leeres `window`
 * (Länge 0) → 0 für alle.
 */
export function dayLoad(
  busy: BusyWindow[],
  window: { start: Date; end: Date },
): Record<PersonKey, number> {
  const span = window.end.getTime() - window.start.getTime();
  const result = { dome: 0, emely: 0 } as Record<PersonKey, number>;
  if (span <= 0) return result;

  for (const person of PERSONS) {
    const mine = busy.filter((b) => b.person === person);
    result[person] = coveredMs(mine, window) / span;
  }
  return result;
}
