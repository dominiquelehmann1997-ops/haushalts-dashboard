// Suche und Filter für die Rezeptliste. Reine Funktionen ohne DB/Next —
// dieselbe Hausform wie `mealPlanner.ts` / `mealWeights.ts`.
//
// Warum in-memory statt SQL: Bei Haushaltsgröße (Dutzende bis wenige Hundert
// Rezepte) ist das schnell genug und deutlich korrekter. SQLite-`LIKE` faltet
// keine Umlaute, `tags` liegt als JSON-String vor, und die Zutaten-Suche
// bräuchte einen Join mit demselben Umlaut-Problem.

import type { Recipe, RecipeFilter, RecipeTagCount } from "@/lib/domain";
import { TRANSLITERATE } from "@/lib/services/recipeImport";

/**
 * Text → vergleichbare Form: kleingeschrieben und transliteriert
 * ("Gemüse" → "gemuese"). Damit findet sowohl "gemüse" als auch die im
 * Deutschen übliche Ersatzschreibweise "gemuese" dasselbe Rezept.
 *
 * Bewusste Grenze: "gemuse" (Umlaut einfach weggelassen) trifft nicht — dafür
 * müsste man zusätzlich diakritikfrei falten, was "ue"-Eingaben wieder bräche.
 * Wir folgen der Konvention, die auch `slugFromName` benutzt.
 */
export function normalizeSearchText(value: string): string {
  const lowered = value.toLowerCase();
  let out = "";
  for (const char of lowered) out += TRANSLITERATE[char] ?? char;
  return out;
}

/** Alle durchsuchbaren Textbestandteile eines Rezepts, schon normalisiert. */
function searchHaystack(recipe: Recipe): string {
  return normalizeSearchText(
    [
      recipe.name,
      ...recipe.tags,
      ...recipe.ingredients.map((i) => i.name),
      ...recipe.steps,
      recipe.notes ?? "",
    ].join(" \n "),
  );
}

/**
 * Volltextsuche über Name, Tags, Zutaten, Zubereitung und Notizen. Mehrere
 * Wörter sind UND-verknüpft und dürfen in beliebiger Reihenfolge und in
 * verschiedenen Feldern stehen ("curry linsen" findet das Linsen-Curry).
 * Leere Suche trifft alles.
 */
export function matchesQuery(recipe: Recipe, query: string): boolean {
  const terms = normalizeSearchText(query).split(/\s+/).filter((t) => t !== "");
  if (terms.length === 0) return true;
  const haystack = searchHaystack(recipe);
  return terms.every((term) => haystack.includes(term));
}

/** True, wenn eine Zutat des Rezepts `needle` enthält (umlautunabhängig). */
export function hasIngredient(recipe: Recipe, needle: string): boolean {
  const n = normalizeSearchText(needle).trim();
  if (n === "") return true;
  return recipe.ingredients.some((i) => normalizeSearchText(i.name).includes(n));
}

/**
 * Wendet den kompletten Filterzustand an. Nicht gesetzte Felder filtern nicht.
 *
 * Rezepte ohne kcal- bzw. Zeitangabe werden von `maxKcal`/`maxMinutes`
 * ausgeschlossen: Wer "höchstens 400 kcal" filtert, will keine Rezepte sehen,
 * bei denen das schlicht unbekannt ist.
 */
export function applyFilters(recipes: Recipe[], filter: RecipeFilter): Recipe[] {
  return recipes.filter((r) => {
    if (filter.query && !matchesQuery(r, filter.query)) return false;
    if (filter.ingredient && !hasIngredient(r, filter.ingredient)) return false;

    if (filter.tags && filter.tags.length > 0) {
      const own = new Set(r.tags.map(normalizeSearchText));
      if (!filter.tags.every((t) => own.has(normalizeSearchText(t)))) return false;
    }

    if (filter.maxKcal !== undefined) {
      if (r.kcal === null || r.kcal > filter.maxKcal) return false;
    }
    if (filter.maxMinutes !== undefined) {
      if (r.totalMinutes === null || r.totalMinutes > filter.maxMinutes) return false;
    }

    if (filter.category && r.category !== filter.category) return false;
    if (filter.rating && r.rating !== filter.rating) return false;
    if (filter.simpleOnly && !r.simple) return false;
    if (filter.reheatableOnly && !r.reheatable) return false;

    return true;
  });
}

/**
 * Distinct-Tagliste mit Häufigkeit, absteigend sortiert (bei Gleichstand
 * alphabetisch) — in dieser Reihenfolge werden die Filter-Chips gerendert,
 * die meistgenutzten zuerst.
 */
export function collectTags(recipes: Recipe[]): RecipeTagCount[] {
  const counts = new Map<string, number>();
  for (const r of recipes) {
    for (const tag of r.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "de"));
}
