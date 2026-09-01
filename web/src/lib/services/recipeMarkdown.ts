// Rezept → Markdown-Datei. Das Gegenstück zum (mit dem Vault-Ausbau
// verschwindenden) Parser: hier schreibt die App, die Wahrheit steht in der DB.
//
// Zweck ist das Backup (`npm run export:recipes`). Das Format bleibt bewusst
// das des alten Vaults, damit die Exporte in Obsidian lesbar sind und sich zur
// Not von Hand wieder eintippen lassen — die Dateien sind für Menschen da, die
// maschinelle Sicherung ist die `prod.db`-Kopie daneben.
//
// Zwei Eigenschaften, auf die sich der Export verlässt:
//   - Deterministisch: gleiches Rezept ⇒ byte-gleiche Datei. Nur dadurch kann
//     der Export unveränderte Dateien in Ruhe lassen, statt Obsidian Sync
//     jede Nacht den kompletten Ordner neu übertragen zu lassen. Deshalb steht
//     hier auch KEIN Exportzeitpunkt in der Datei.
//   - Erkennbar: `exportedBy` markiert die Datei als von uns erzeugt. Nur so
//     markierte Dateien räumt der Export wieder weg (siehe `isExportedFile`) —
//     zeigt `RECIPE_EXPORT_PATH` auf den alten Vault, liegen dort handgepflegte
//     Notizen, die niemand anfassen darf.

import matter from "gray-matter";

import type { Recipe } from "@/lib/domain";
import { slugFromName } from "@/lib/services/recipeImport";

/** Wert von `exportedBy` im Frontmatter — die Signatur unserer Exportdateien. */
export const EXPORT_MARKER = "haushalts-dashboard";

/** Nur eine Zutatenzeile, wie sie ins Frontmatter geht (ohne leere Felder). */
interface FrontmatterIngredient {
  name: string;
  amount?: string;
  unit?: string;
  section?: string;
}

/**
 * Rezept → Dateiinhalt (Frontmatter + Body). Leere Felder werden weggelassen
 * statt als `null` geschrieben: eine fehlende Angabe ist keine Angabe, und die
 * Datei bleibt lesbar.
 */
export function recipeToMarkdown(recipe: Recipe): string {
  const data: Record<string, unknown> = {};

  // `id` ist der Identitäts-Anker des Vault-Formats. App-eigene Rezepte haben
  // keinen Slug — dann steht er auch nicht drin.
  if (recipe.slug) data.id = recipe.slug;
  data.name = recipe.name;
  data.rating = recipe.rating;
  data.simple = recipe.simple;
  data.reheatable = recipe.reheatable;
  if (recipe.tags.length > 0) data.tags = recipe.tags;
  if (recipe.servings !== null) data.servings = recipe.servings;
  if (recipe.prepMinutes !== null) data.prepMinutes = recipe.prepMinutes;
  if (recipe.cookMinutes !== null) data.cookMinutes = recipe.cookMinutes;
  if (
    recipe.kcal !== null ||
    recipe.protein !== null ||
    recipe.carbs !== null ||
    recipe.fat !== null
  ) {
    const nutrition: Record<string, number> = {};
    if (recipe.kcal !== null) nutrition.kcal = recipe.kcal;
    if (recipe.protein !== null) nutrition.protein = recipe.protein;
    if (recipe.carbs !== null) nutrition.carbs = recipe.carbs;
    if (recipe.fat !== null) nutrition.fat = recipe.fat;
    data.nutrition = nutrition;
  }
  if (recipe.sourceUrl) data.source = recipe.sourceUrl;
  // Archivierte Rezepte gehören ins Backup — ein Backup, das stillschweigend
  // Daten weglässt, ist keines. Das Feld sagt, warum sie in der App fehlen.
  if (recipe.archived) data.archived = true;
  if (recipe.ingredients.length > 0) {
    data.ingredients = recipe.ingredients.map((i): FrontmatterIngredient => {
      const out: FrontmatterIngredient = { name: i.name };
      if (i.amount) out.amount = i.amount;
      if (i.unit) out.unit = i.unit;
      if (i.section) out.section = i.section;
      return out;
    });
  }
  data.exportedBy = EXPORT_MARKER;

  return matter.stringify(buildBody(recipe), data);
}

/**
 * Der Markdown-Body: Zubereitung, Notizen, Quelle — jeder Abschnitt nur, wenn
 * es ihn gibt. Die Reihenfolge entspricht dem alten Vault-Format.
 */
function buildBody(recipe: Recipe): string {
  const sections: string[] = [];

  if (recipe.steps.length > 0) {
    // Zeilenumbrüche innerhalb eines Schritts werden zu Leerzeichen: eine
    // nummerierte Liste ist zeilenbasiert, ein mehrzeiliger Schritt würde beim
    // Lesen zu mehreren Schritten zerfallen.
    const steps = recipe.steps.map(
      (step, index) => `${index + 1}. ${step.replace(/\s*\n\s*/g, " ").trim()}`,
    );
    sections.push(`## Zubereitung\n\n${steps.join("\n")}`);
  }

  if (recipe.notes && recipe.notes.trim() !== "") {
    sections.push(`## Notizen\n\n${recipe.notes.trim()}`);
  }

  if (recipe.sourceUrl) {
    sections.push(`## Quelle\n\n${recipe.sourceUrl}`);
  }

  return sections.length > 0 ? `\n${sections.join("\n\n")}\n` : "";
}

/**
 * Stammt die Datei aus unserem Export? Nur solche Dateien darf der Export
 * wieder löschen. Alles Unlesbare gilt als fremd — im Zweifel nicht anfassen.
 */
export function isExportedFile(content: string): boolean {
  try {
    return matter(content).data?.exportedBy === EXPORT_MARKER;
  } catch {
    return false;
  }
}

/**
 * Rezepte → Dateinamen, kollisionsfrei. Der Name kommt aus `slugFromName`,
 * ist also derselbe, den auch der Link-Import als Slug vergibt.
 *
 * Zwei Rezepte dürfen denselben Namen tragen (`Recipe.name` ist nicht unique),
 * dann fällt der zweite auf seine id zurück, statt den ersten zu überschreiben.
 * Wer den Zuschlag bekommt, entscheidet die Reihenfolge der Liste — die ist
 * alphabetisch und damit stabil.
 */
export function assignExportFileNames(recipes: Pick<Recipe, "id" | "name">[]): Map<string, string> {
  const names = new Map<string, string>();
  const taken = new Set<string>();

  for (const recipe of recipes) {
    const base = slugFromName(recipe.name);
    // Ein Name ganz ohne verwertbare Zeichen ("???") ergibt einen leeren Slug.
    let file = base === "" ? `rezept-${recipe.id}.md` : `${base}.md`;
    if (taken.has(file)) file = `${base}-${recipe.id}.md`;
    taken.add(file);
    names.set(recipe.id, file);
  }

  return names;
}
