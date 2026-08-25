// Reine Vault-Parsing-Logik (kein DB/Next). Wandelt eine Rezept-Markdown-Datei
// (Frontmatter via gray-matter + Body) in ein `ParsedRecipe`.
//
// ÜBERGANGS-CODE: Der Vault wird von der DB als Wahrheit abgelöst. Dieser Parser
// existiert nur noch für die einmalige Übernahme (`prisma/migrateVaultToDb.ts`)
// und liest deshalb auch die Felder, die der frühere Ingest bewusst verwarf —
// Portionen, Zeiten, Nährwerte, Quelle und die Zubereitungsschritte.

import matter from "gray-matter";

export type Rating = "favorit" | "ok" | "selten";
const RATINGS: Rating[] = ["favorit", "ok", "selten"];

export interface ParsedIngredient {
  name: string;
  amount: string | null;
  unit: string | null;
}

export interface ParsedRecipe {
  id: string | null; // Frontmatter `id` (Slug); null → Caller leitet aus Dateinamen ab
  name: string;
  rating: Rating;
  simple: boolean;
  reheatable: boolean;
  tags: string | null; // JSON-String oder null
  ingredients: ParsedIngredient[];
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  kcal: number | null;
  protein: number | null;
  sourceUrl: string | null;
  steps: string[]; // leer, wenn die Notiz keine Zubereitung enthält
}

export interface ParseResult {
  recipe: ParsedRecipe | null;
  errors: string[];
}

/** Dateiname → stabiler Fallback-Slug (lowercased, dasherized). */
export function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Frontmatter-Zahl → `number | null`. YAML liefert je nach Schreibweise Zahl
 * oder String ("4" bzw. `servings: '4'`); beides muss durchgehen. Negative
 * Werte und Nicht-Zahlen ergeben null statt eines stillen 0-Werts.
 */
function toPositiveIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseIngredients(raw: unknown, errors: string[]): ParsedIngredient[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedIngredient[] = [];
  for (const entry of raw) {
    const name = entry && typeof entry === "object" ? (entry as Record<string, unknown>).name : undefined;
    if (typeof name !== "string" || name.trim() === "") {
      errors.push(`Ingredient ohne Namen übersprungen: ${JSON.stringify(entry)}`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    out.push({
      name: name.trim(),
      amount: toStringOrNull(e.amount),
      unit: toStringOrNull(e.unit),
    });
  }
  return out;
}

/**
 * Zubereitungsschritte aus dem Markdown-Body. Bevorzugt den Abschnitt
 * `## Zubereitung` (so schreibt der URL-Importer), sonst den Text bis zur
 * ersten Überschrift — handgeschriebene Notizen haben oft gar keine. Der
 * Abschnitt `## Quelle` bleibt außen vor, er ist keine Anleitung.
 *
 * Listenmarker (`1.`, `2)`, `-`, `*`) werden abgeschnitten: die Nummerierung
 * gehört in die Darstellung, nicht in die Daten.
 */
export function parseSteps(body: string): string[] {
  const heading = body.match(/^#{1,6}[ \t]*Zubereitung[ \t]*$/im);
  let section: string;
  if (heading) {
    // Ab der Überschrift bis zur nächsten Überschrift (oder Dateiende).
    const rest = body.slice(heading.index! + heading[0].length);
    const nextHeading = rest.search(/^#{1,6}[ \t]/m);
    section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  } else {
    // Keine Zubereitungs-Überschrift: alles bis zur ersten Überschrift.
    section = body.split(/^#{1,6}[ \t]/m)[0];
  }

  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => line.replace(/^(?:\d+[.)]|[-*+])\s*/, "").trim())
    .filter((line) => line !== "");
}

/**
 * Parst eine Rezept-Markdown-Datei. Pflichtfeld: `name`. Fehlt es, ist
 * `recipe` null und `errors` erklärt warum. `rating` fällt auf "ok" zurück,
 * `simple` auf true, `reheatable` auf false. `tags` (Array) wird zu JSON.
 * Zahlenfelder und `nutrition` sind optional — fehlende Angaben bleiben null,
 * das ist kein Fehler.
 */
export function parseRecipeMarkdown(content: string): ParseResult {
  const errors: string[] = [];
  const { data, content: body } = matter(content);

  const name = data.name;
  if (typeof name !== "string" || name.trim() === "") {
    errors.push("Pflichtfeld `name` fehlt oder ist leer.");
    return { recipe: null, errors };
  }

  const rating: Rating = RATINGS.includes(data.rating) ? data.rating : "ok";
  const simple = typeof data.simple === "boolean" ? data.simple : true;
  const reheatable = typeof data.reheatable === "boolean" ? data.reheatable : false;
  const tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : null;
  const id = typeof data.id === "string" && data.id.trim() !== "" ? data.id.trim() : null;

  const ingredients = parseIngredients(data.ingredients, errors);

  // `nutrition` ist ein optionaler Block — fehlt er, sind kcal/protein null.
  const nutrition =
    data.nutrition && typeof data.nutrition === "object"
      ? (data.nutrition as Record<string, unknown>)
      : {};

  // `source` trägt beim Importer die Herkunfts-URL, bei Claude-Ideen den Wert
  // "claude". Nur echte URLs sind als Quelle brauchbar.
  const rawSource = toStringOrNull(data.source);
  const sourceUrl = rawSource && /^https?:\/\//i.test(rawSource) ? rawSource : null;

  return {
    recipe: {
      id,
      name: name.trim(),
      rating,
      simple,
      reheatable,
      tags,
      ingredients,
      servings: toPositiveIntOrNull(data.servings),
      prepMinutes: toPositiveIntOrNull(data.prepMinutes),
      cookMinutes: toPositiveIntOrNull(data.cookMinutes),
      kcal: toPositiveIntOrNull(nutrition.kcal),
      protein: toPositiveIntOrNull(nutrition.protein),
      sourceUrl,
      steps: parseSteps(body),
    },
    errors,
  };
}
