// Feature B (Sanftes Lernen): learned task interval.
// EWMA of the REAL gaps (in days) between a routine's completions. Damped:
// needs at least MIN_INTERVALS observed gaps before it counts; otherwise the
// configured `rhythm` stays the source of truth. Pure — no DB, no clock.

const ALPHA = 0.25;
const MIN_INTERVALS = 3;

/**
 * Exponentially-weighted moving average of completion gaps (oldest → newest).
 * Returns `null` until at least MIN_INTERVALS gaps exist, so the caller falls
 * back to the configured rhythm. The most recent gap carries the most weight.
 */
export function learnedInterval(intervalsInDays: number[]): number | null {
  if (intervalsInDays.length < MIN_INTERVALS) return null;

  let ewma = intervalsInDays[0]!;
  for (let i = 1; i < intervalsInDays.length; i++) {
    ewma = ALPHA * intervalsInDays[i]! + (1 - ALPHA) * ewma;
  }
  return ewma;
}
