// Reine Auto-Theme-Logik fürs Tablet: dunkel, wenn die aktuelle Uhrzeit vor
// Sonnenaufgang oder ab Sonnenuntergang liegt. Sonnenzeiten kommen als lokale
// "HH:MM" aus dem Wetter (`CurrentWeather.sunrise`/`sunset`). Pure (kein
// React/DB) → unit-testbar; der Client-Hook in `dashboard.tsx` ruft sie pro Minute.

/** Parst "HH:MM" in Minuten seit Mitternacht, oder `null` bei ungültigem/leerem Wert. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * `true` (dunkel), wenn `now` vor `sunrise` oder ab `sunset` liegt.
 * Fehlen/ungültige Sonnenzeiten → `false` (hell): sicherer Default, wenn die
 * Wetter-Abfrage scheitert (Fallback liefert leere Strings).
 */
export function isDarkBySun(now: Date, sunrise: string, sunset: string): boolean {
  const rise = toMinutes(sunrise);
  const set = toMinutes(sunset);
  if (rise === null || set === null) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin < rise || nowMin >= set;
}
