// Feature B (Sanftes Lernen): learned task interval.
// EWMA of the REAL gaps (in days) between a routine's completions. Damped:
// needs at least MIN_INTERVALS observed gaps before it counts; otherwise the
// configured `rhythm` stays the source of truth. Pure — no DB, no clock.
//
// Zwei Sicherungen halten das Lernen an der Realität statt an Ausreißern:
//
// 1. **Urlaubslücken** — Abstände über OUTLIER_FACTOR × Rhythmus sind keine
//    Aussage über den nötigen Takt, sondern Abwesenheit (Urlaub, Krankheit).
//    Sie fließen gar nicht erst in den Mittelwert ein.
// 2. **Deckel** — das Ergebnis darf den konfigurierten Rhythmus höchstens um
//    MAX_STRETCH strecken. Ohne ihn entsteht eine selbstverstärkende Schleife:
//    längere Abstände → längeres Intervall → seltenere Aufgaben → längere
//    Abstände. "Gassi gehen" (daily) war so real auf ~3 Tage abgedriftet.
//
// Verkürzen ist bewusst NICHT gedeckelt — wer eine Aufgabe häufiger erledigt
// als geplant, soll sie auch häufiger vorgeschlagen bekommen.

const ALPHA = 0.25;
const MIN_INTERVALS = 3;

/** Abstände über diesem Vielfachen des Rhythmus gelten als Abwesenheit. */
const OUTLIER_FACTOR = 3;

/** Das gelernte Intervall darf den Rhythmus höchstens so weit strecken. */
const MAX_STRETCH = 2;

/**
 * Exponentially-weighted moving average of completion gaps (oldest → newest),
 * relative to `configuredDays` (the rhythm's own interval in days).
 *
 * Gaps beyond `OUTLIER_FACTOR × configuredDays` are dropped as absences before
 * averaging. Returns `null` when fewer than MIN_INTERVALS *usable* gaps remain,
 * so the caller falls back to the configured rhythm. The most recent gap
 * carries the most weight. The result is capped at `MAX_STRETCH ×
 * configuredDays`; shortening is unbounded.
 */
export function learnedInterval(
  intervalsInDays: number[],
  configuredDays: number,
): number | null {
  if (!(configuredDays > 0)) return null;

  const usable = intervalsInDays.filter((gap) => gap <= OUTLIER_FACTOR * configuredDays);
  if (usable.length < MIN_INTERVALS) return null;

  let ewma = usable[0]!;
  for (let i = 1; i < usable.length; i++) {
    ewma = ALPHA * usable[i]! + (1 - ALPHA) * ewma;
  }
  return Math.min(ewma, MAX_STRETCH * configuredDays);
}
