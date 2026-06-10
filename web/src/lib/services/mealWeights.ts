// Gewichtete Rezept-Auswahl für den Essensplan (Feature A, "sanftes Lernen").
// Reine Funktionen ohne DB/Next: Rating-Gewicht × Recency-Dämpfung treiben ein
// Roulette-Rad, der injizierte `rng` hält die Auswahl in Tests deterministisch.
// Constraints bleiben harte Filter — gewichtet wird nur INNERHALB des Pools.

import type { Rating } from "@/lib/services/recipeVault";

// `satisfies` sichert die Tabelle gegen den Domänen-Typ ab (alle Rating-Werte
// abgedeckt, keine Tippfehler-Keys); die Funktionen nehmen bewusst `string`,
// weil Prisma `Recipe.rating` untypisiert liefert — unbekannt → Gewicht 1 ("ok").
const RATING_WEIGHTS: Record<string, number> = {
  favorit: 3,
  ok: 1,
  selten: 0.3,
} satisfies Record<Rating, number>;

export function ratingWeight(rating: string): number {
  return RATING_WEIGHTS[rating] ?? 1;
}

/** Tage, über die die Recency-Dämpfung linear ausläuft. */
export const RECENCY_RAMP_DAYS = 14;
/** Untergrenze der Dämpfung — kürzlich Gekochtes bleibt wählbar, nur unwahrscheinlicher. */
export const RECENCY_FLOOR = 0.15;

/**
 * Dämpfungsfaktor aus "vor wie vielen Tagen zuletzt gekocht": `null` (nie /
 * außerhalb des Fensters) → 1; innerhalb der Rampe linear `daysAgo/14`,
 * nie unter `RECENCY_FLOOR`.
 */
export function recencyFactor(daysAgo: number | null): number {
  if (daysAgo === null || daysAgo >= RECENCY_RAMP_DAYS) return 1;
  return Math.max(RECENCY_FLOOR, daysAgo / RECENCY_RAMP_DAYS);
}

/** Gesamtgewicht eines Rezepts: Rating-Gewicht × Recency-Faktor. */
export function recipeWeight(rating: string, lastUsedDaysAgo: number | null): number {
  return ratingWeight(rating) * recencyFactor(lastUsedDaysAgo);
}

/**
 * Gewichteter Pick (Roulette-Rad) aus `pool`. `lastUsedDaysAgo` mappt
 * recipeId → Tage seit letzter aktiver Verwendung (fehlend = nie kürzlich).
 * `rng() ∈ [0,1)` injizierbar → deterministisch testbar; rng 0 wählt das
 * erste Element, rng nahe 1 das letzte. Leerer Pool → null.
 */
export function weightedPick<T extends { id: string; rating: string }>(
  pool: T[],
  lastUsedDaysAgo: Map<string, number>,
  rng: () => number,
): T | null {
  if (pool.length === 0) return null;
  const weights = pool.map((item) => recipeWeight(item.rating, lastUsedDaysAgo.get(item.id) ?? null));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let rest = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    rest -= weights[i];
    if (rest < 0) return pool[i];
  }
  return pool[pool.length - 1]; // Fließkomma-Kante (rng → 1)
}
