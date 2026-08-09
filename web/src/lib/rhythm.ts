// Rhythmen einer wiederkehrenden Routine — Presets plus freie "alle N Tage".
//
// Bewusst ein pures Leaf-Modul OHNE Imports: es wird sowohl serverseitig
// (`@/lib/services/recurrence`, `@/lib/repositories/tasks`) als auch im Client
// (Routinen-Seite) gebraucht. Läge es weiterhin in `tasks.ts`, zöge ein
// Wert-Import Prisma in das Client-Bundle.
//
// Speicherformat der freien Intervalle ist `"${n}-day"` — dasselbe Muster, das
// die Presets "3-day"/"5-day" schon verwenden. Dadurch braucht es kein neues
// Feld in der Datenbank; ein Custom-Rhythmus ist für alles Bestehende einfach
// ein weiterer Rhythmus-String.

/** Obergrenze für freie Intervalle. Ein Jahr ist für Haushalts-Routinen genug. */
export const CUSTOM_RHYTHM_MAX_DAYS = 365;

/** Erlaubte Preset-Rhythmen mit deutschen Labels — deckt sich mit `recurrence.ts`. */
export const RHYTHM_OPTIONS: { value: string; label: string }[] = [
  { value: "daily", label: "Täglich" },
  { value: "2x-week", label: "2× pro Woche" },
  { value: "3-day", label: "Alle 3 Tage" },
  { value: "5-day", label: "Alle 5 Tage" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "biweekly", label: "Alle 2 Wochen" },
  { value: "monthly", label: "Monatlich" },
  { value: "halfyearly", label: "Halbjährlich" },
];

const PRESET_VALUES = new Set(RHYTHM_OPTIONS.map((r) => r.value));

const CUSTOM_PATTERN = /^(\d{1,3})-day$/;

/**
 * Tagesanzahl eines freien Rhythmus (`"10-day"` → `10`), sonst `null`.
 * Außerhalb von 1…{@link CUSTOM_RHYTHM_MAX_DAYS} liegende Werte gelten als
 * ungültig — `"0-day"` und `"400-day"` liefern `null`.
 *
 * Die Presets `"3-day"`/`"5-day"` matchen ebenfalls; das ist gewollt, sie
 * bedeuten exakt dasselbe.
 */
export function parseCustomRhythm(value: string): number | null {
  const match = CUSTOM_PATTERN.exec(value);
  if (!match) return null;

  const days = Number(match[1]);
  if (days < 1 || days > CUSTOM_RHYTHM_MAX_DAYS) return null;
  return days;
}

/** Rhythmus-String für ein freies Intervall von `days` Tagen. */
export function makeCustomRhythm(days: number): string {
  return `${days}-day`;
}

/** `true` für Presets und gültige freie Intervalle. */
export function isValidRhythm(value: string): boolean {
  return PRESET_VALUES.has(value) || parseCustomRhythm(value) !== null;
}

/** Deutsches Label für die Anzeige — Preset-Label, "Alle N Tage" oder Hinweis. */
export function rhythmLabel(rhythm: string | null): string {
  if (rhythm === null || rhythm === "") return "Kein Rhythmus";

  const preset = RHYTHM_OPTIONS.find((r) => r.value === rhythm);
  if (preset) return preset.label;

  const days = parseCustomRhythm(rhythm);
  if (days === 1) return "Täglich";
  if (days !== null) return `Alle ${days} Tage`;

  return rhythm;
}
