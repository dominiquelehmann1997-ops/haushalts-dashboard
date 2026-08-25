// Portionsrechner der Kochansicht: rechnet die Zutatenmengen eines Rezepts auf
// eine andere Portionszahl um. Rein und ohne DB.
//
// Mengen sind Strings, keine Zahlen — der Importer räumt sie zwar auf ("½ TL"
// → "0,5 TL"), lässt aber Bereiche wie "2-3" und Angaben wie "etwas" bewusst
// als Text stehen (siehe recipeImport.ts). Alles, was sich nicht als Zahl
// lesen lässt, wird deshalb unverändert durchgereicht: lieber eine ehrliche
// Originalangabe als eine erfundene Zahl.

import { formatNumber, parseAmount } from "@/lib/services/ingredientAmount";
import type { RecipeIngredient } from "@/lib/domain";

/** Sinnvolle Grenzen für den Regler — mehr als 20 Portionen plant hier niemand. */
export const MIN_PORTIONS = 1;
export const MAX_PORTIONS = 20;

/** Hält eine Portionszahl in den erlaubten Grenzen und macht sie ganzzahlig. */
export function clampPortions(value: number): number {
  if (!Number.isFinite(value)) return MIN_PORTIONS;
  return Math.min(MAX_PORTIONS, Math.max(MIN_PORTIONS, Math.round(value)));
}

/**
 * Skaliert eine einzelne Mengenangabe. Nicht-numerische Angaben und `null`
 * bleiben unverändert. Faktor 1 gibt das Original zurück, ohne umzuformatieren
 * — "400" soll nicht plötzlich anders aussehen, nur weil man den Regler
 * einmal hin und zurück geschoben hat.
 */
export function scaleAmount(amount: string | null, factor: number): string | null {
  if (amount === null) return null;
  const trimmed = amount.trim();
  if (trimmed === "" || factor === 1) return amount;

  const n = parseAmount(trimmed);
  if (n === null) return amount;

  return formatNumber(n * factor);
}

/**
 * Skaliert alle Zutaten von `baseServings` auf `targetServings`.
 *
 * Ohne bekannte Ausgangsportionen (`baseServings` null oder 0) wird nicht
 * gerechnet: Ein Rezept ohne Portionsangabe lässt sich nicht sinnvoll
 * hochrechnen, und geraten wäre schlimmer als nichts zu tun.
 */
export function scaleIngredients(
  ingredients: RecipeIngredient[],
  baseServings: number | null,
  targetServings: number,
): RecipeIngredient[] {
  if (!baseServings || baseServings <= 0) return ingredients;
  const factor = targetServings / baseServings;
  if (factor === 1) return ingredients;
  return ingredients.map((i) => ({ ...i, amount: scaleAmount(i.amount, factor) }));
}
