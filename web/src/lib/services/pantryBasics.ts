// Vorrats-Basics — Zutaten, die man typischerweise immer zuhause hat und die
// deshalb nicht auf den Einkaufszettel gehören. Keyword-Matching (lowercase
// Substring), analog zu FRESH_KEYWORDS in freshness.ts.

const PANTRY_BASICS_KEYWORDS = [
  // Öle (olivenöl, rapsöl, sonnenblumenöl, öl, …)
  "öl",
  // Grundgewürze
  "salz",
  "pfeffer",
  // Trockene Gewürze (keine Verwechslungsgefahr mit frischen Kräutern)
  "oregano",
  "paprikapulver",
  "zimt",
  "kreuzkümmel",
  "kurkuma",
  "cayenne",
  "muskat",
  "lorbeer",
  "kümmel",
  // Backtriebmittel
  "backpulver",
  "natron",
  // Sonstiges
  "essig",
  "sojasauce",
] as const;

/**
 * Gibt `true` zurück, wenn die Zutat ein Vorrats-Basic ist, das typischerweise
 * immer zuhause vorrätig ist und nicht auf den Einkaufszettel gehört.
 *
 * Frische Kräuter (Basilikum, Petersilie, …) und Knoblauch sind bewusst NICHT
 * enthalten — die muss man tatsächlich kaufen.
 */
export function isPantryBasic(name: string): boolean {
  const n = name.trim().toLowerCase();
  return PANTRY_BASICS_KEYWORDS.some((kw) => n.includes(kw));
}
