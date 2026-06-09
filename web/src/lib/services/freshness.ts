// Reine Haltbarkeits-Heuristik für Zutaten + Vorschlagstag für den Frische-
// Einkauf. Kein DB/Next. Die Heuristik ist bewusst grob (überschreibbar über
// `Ingredient.category`); sie liefert nur einen sinnvollen Default.

import { addDays } from "@/lib/dates";

export type Freshness = "frisch" | "haltbar";

/** Namens-Schlüsselwörter (lowercased), die auf eine frische Zutat hindeuten. */
const FRESH_KEYWORDS = [
  "salat",
  "milch",
  "joghurt",
  "sahne",
  "quark",
  "fleisch",
  "hack",
  "hähnchen",
  "fisch",
  "lachs",
  "kräuter",
  "basilikum",
  "petersilie",
  "schnittlauch",
  "tomate",
  "gurke",
  "zucchini",
  "paprika",
  "karotte",
  "möhre",
  "banane",
  "apfel",
  "beeren",
  "eier",
] as const;

/**
 * Grobe Haltbarkeits-Kategorie aus dem Zutaten-Namen: enthält der (lowercased)
 * Name eines der Frisch-Schlüsselwörter → "frisch", sonst → "haltbar" (Default).
 */
export function classifyFreshness(name: string): Freshness {
  const n = name.trim().toLowerCase();
  return FRESH_KEYWORDS.some((kw) => n.includes(kw)) ? "frisch" : "haltbar";
}

/**
 * Vorschlagstag für die Frische-Rutsche: der Tag VOR dem frühesten Verbrauchstag
 * einer Frisch-Zutat (etwas Vorlauf). `null`, wenn es keinen Frisch-Verbrauch gibt.
 */
export function suggestFreshShoppingDay(earliestFreshUse: Date | null): Date | null {
  return earliestFreshUse ? addDays(earliestFreshUse, -1) : null;
}
