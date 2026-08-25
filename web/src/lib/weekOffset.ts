// Erlaubte Spanne der Essensplan-Wochenwahl (Vorausplanung), als reines Modul
// getrennt von der Nav-Komponente — damit die Klemm-Logik ohne React testbar ist.
//
// Die Spanne ist bewusst eng: der Kalender-Sync holt nur ein 14-Tage-Fenster
// (siehe `calendarSync`). Jenseits davon wäre der Essensplan blind für Domes
// Dienstplan und die dienstbewussten Constraints fielen still weg.

/** Weiteste rückwärts anwählbare Woche (Nachschauen, was letzte Woche lief). */
export const MIN_WEEK_OFFSET = -1;

/** Weiteste vorausplanbare Woche — gedeckt vom 14-Tage-Kalenderfenster. */
export const MAX_WEEK_OFFSET = 2;

/**
 * Klemmt einen (aus der URL geparsten, also beliebigen) Offset in die erlaubte
 * Spanne. `NaN`/`Infinity` — etwa aus `?w=abc` — fallen auf die laufende Woche
 * zurück, statt die Wochenberechnung mit einem ungültigen Datum zu vergiften.
 */
export function clampWeekOffset(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  // `Math.trunc(-0.9)` ist -0; `|| 0` normalisiert das auf +0, damit daraus
  // keine "?w=-0"-URL wird.
  const weeks = Math.trunc(raw) || 0;
  return Math.min(MAX_WEEK_OFFSET, Math.max(MIN_WEEK_OFFSET, weeks));
}
