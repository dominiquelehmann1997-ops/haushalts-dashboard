// Grobe Heuristik: Ist das Rezept vegetarisch? Prüft die Zutaten-Namen auf
// Fleisch- und Fischbegriffe. Kein Treffer ⇒ vegetarisch.
//
// Bewusst nur lange, eindeutige Stämme als Substring — kurze, mehrdeutige
// ("hack" in "gehackt", "ham" in "Champignon", "rind" in "Tamarinde") sind
// absichtlich NICHT gelistet, um vegetarische Rezepte nicht falsch zu
// markieren. Portiert aus VegetarianHeuristic.kt (ObsidiDine).

const MEAT_FISH = [
  // Geflügel
  "hähnchen", "hühnchen", "hühner", "huhn", "geflügel", "pute", "puten",
  "truthahn", "ente",
  // Rind / Schwein / sonstiges Fleisch
  "rinder", "rindfleisch", "hackfleisch", "tatar", "tartar", "schwein",
  "speck", "bacon", "schinken", "wurst", "würstchen", "cabanossi", "salami",
  "chorizo", "mettwurst", "leberkäse", "leberwurst", "kalb", "lammfleisch",
  "gulasch", "gyros", "döner", "fleisch", "knochen",
  // Fisch & Meeresfrüchte
  "fisch", "thunfisch", "lachs", "garnele", "scampi", "shrimp", "prawn",
  "krabbe", "hummer", "hering", "sardelle", "sardine", "makrele", "forelle",
  "tintenfisch", "anchovi",
  // Tierische Geliermittel
  "gelatine", "gelantine",
  // Englische Fallbacks
  "chicken", "beef", "pork", "sausage", "salmon", "tuna",
];

export const VEGETARIAN_TAG = "vegetarisch";

export function isVegetarian(ingredients: { name: string }[]): boolean {
  const names = ingredients.map((i) => i.name).join(" ").toLowerCase();
  return !MEAT_FISH.some((term) => names.includes(term));
}

/** Hängt `vegetarisch` an, wenn es passt und noch nicht (in beliebiger Schreibweise) drinsteht. */
export function withVegetarianTag(
  tags: string[],
  ingredients: { name: string }[],
): string[] {
  if (!isVegetarian(ingredients)) return tags;
  if (tags.some((t) => t.toLowerCase() === VEGETARIAN_TAG)) return tags;
  return [...tags, VEGETARIAN_TAG];
}
