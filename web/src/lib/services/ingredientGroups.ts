// Zutaten-Gruppen für die Anzeige. Der Importer liefert pro Zutat ein
// `section` ("Für die Soße", "Dip", …); gespeichert wird das flach, weil die
// Reihenfolge der Zutaten die Reihenfolge der Quelle ist.
//
// Hier wird daraus für die Darstellung wieder eine Blockstruktur — bewusst nur
// über **aufeinanderfolgende** Zutaten. Gleichnamige Gruppen, die durch eine
// andere getrennt sind, bleiben getrennt: die Quellreihenfolge ist die
// Kochreihenfolge, Umsortieren würde ein Rezept verfälschen.

/** Nur das Feld, das gebraucht wird — so ist die Funktion für jede Zutatenform nutzbar. */
interface HasSection {
  section: string | null;
}

export interface IngredientGroup<T> {
  /** null = keine Überschrift (Zutaten ohne Gruppe, z.B. vor der ersten). */
  section: string | null;
  items: T[];
}

/** Leere und reine Leerraum-Gruppen zählen als „keine Gruppe". */
function normalize(section: string | null): string | null {
  const trimmed = section?.trim();
  return trimmed ? trimmed : null;
}

/** true, wenn mindestens eine Zutat eine echte Gruppe trägt. */
export function hasSections(ingredients: HasSection[]): boolean {
  return ingredients.some((i) => normalize(i.section) !== null);
}

/**
 * Fasst aufeinanderfolgende Zutaten derselben Gruppe zusammen. Reihenfolge und
 * Vollständigkeit bleiben erhalten; eine leere Liste ergibt keine Gruppe.
 */
export function groupIngredientsBySection<T extends HasSection>(
  ingredients: T[],
): IngredientGroup<T>[] {
  const groups: IngredientGroup<T>[] = [];
  for (const item of ingredients) {
    const section = normalize(item.section);
    const current = groups[groups.length - 1];
    if (current && current.section === section) current.items.push(item);
    else groups.push({ section, items: [item] });
  }
  return groups;
}
