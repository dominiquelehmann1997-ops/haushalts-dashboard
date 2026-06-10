// Reine Vault-Parsing-Logik (kein DB/Next). Wandelt eine Rezept-Markdown-Datei
// (Frontmatter via gray-matter + Body) in ein `ParsedRecipe`. Die DB-Spiegelung
// übernimmt `recipeIngest.ts`.

import matter from "gray-matter";

import type { Freshness } from "@/lib/services/freshness";

export type Rating = "favorit" | "ok" | "selten";
const RATINGS: Rating[] = ["favorit", "ok", "selten"];

export interface ParsedIngredient {
  name: string;
  amount: string | null;
  unit: string | null;
  category: Freshness | null; // aus Frontmatter `freshness`; null → später Heuristik
}

export interface ParsedRecipe {
  id: string | null; // Frontmatter `id` (Slug); null → Caller leitet aus Dateinamen ab
  name: string;
  rating: Rating;
  simple: boolean;
  reheatable: boolean;
  tags: string | null; // JSON-String oder null
  ingredients: ParsedIngredient[];
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
    const freshness = e.freshness;
    const category: Freshness | null =
      freshness === "frisch" || freshness === "haltbar" ? freshness : null;
    out.push({
      name: name.trim(),
      amount: toStringOrNull(e.amount),
      unit: toStringOrNull(e.unit),
      category,
    });
  }
  return out;
}

/**
 * Parst eine Rezept-Markdown-Datei. Pflichtfeld: `name`. Fehlt es, ist
 * `recipe` null und `errors` erklärt warum. `rating` fällt auf "ok" zurück,
 * `simple` auf true, `reheatable` auf false. `tags` (Array) wird zu JSON.
 */
export function parseRecipeMarkdown(content: string): ParseResult {
  const errors: string[] = [];
  const { data } = matter(content);

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

  return {
    recipe: { id, name: name.trim(), rating, simple, reheatable, tags, ingredients },
    errors,
  };
}
