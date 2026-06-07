import type { BusyWindow, PersonKey } from "./types";

function overlaps(busy: BusyWindow, window: { start: Date; end: Date }): boolean {
  return busy.start < window.end && busy.end > window.start;
}

/**
 * Returns the subset of `persons` who have no busy window overlapping `window`.
 * Without a `window` we cannot determine a time conflict, so all persons pass through.
 */
export function filterByAvailability(
  persons: PersonKey[],
  window: { start: Date; end: Date } | undefined,
  busy: BusyWindow[],
): PersonKey[] {
  if (!window) return persons;

  return persons.filter(
    (person) => !busy.some((b) => b.person === person && overlaps(b, window)),
  );
}
