// Übersetzt zwischen den Suchparametern der Rezeptseite und `RecipeFilter`.
// Rein und ohne Next-Abhängigkeit, damit beides testbar bleibt.
//
// Der Filterzustand steht bewusst in der URL und nicht im Komponenten-State:
// so überlebt er den Zurück-Button, lässt sich als Lesezeichen ablegen, und
// die Liste kann serverseitig gerendert werden.

import type { RecipeCategory, RecipeFilter } from "@/lib/domain";
import { RECIPE_CATEGORIES } from "@/lib/domain";

/** Rohe Suchparameter, wie Next sie liefert. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export const PARAM = {
  query: "q",
  tag: "tag",
  ingredient: "zutat",
  maxKcal: "kcal",
  maxMinutes: "zeit",
  rating: "bewertung",
  category: "kategorie",
  simple: "einfach",
  reheatable: "aufwaermbar",
} as const;

const RATINGS = ["favorit", "ok", "selten"];

function firstValue(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Mehrfach vorkommende Parameter (`?tag=a&tag=b`) zu einer Liste. */
function allValues(raw: string | string[] | undefined): string[] {
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return list.map((v) => v.trim()).filter((v) => v !== "");
}

/** Positive Ganzzahl oder `undefined` — Unsinn filtert lieber gar nicht. */
function positiveInt(raw: string | string[] | undefined): number | undefined {
  const value = firstValue(raw);
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

function isOn(raw: string | string[] | undefined): boolean {
  return firstValue(raw) === "1";
}

/** Suchparameter → Filter. Unbekannte oder unsinnige Werte werden ignoriert. */
export function parseRecipeFilter(params: RawSearchParams): RecipeFilter {
  const filter: RecipeFilter = {};

  const query = firstValue(params[PARAM.query]);
  if (query) filter.query = query;

  const tags = allValues(params[PARAM.tag]);
  if (tags.length > 0) filter.tags = tags;

  const ingredient = firstValue(params[PARAM.ingredient]);
  if (ingredient) filter.ingredient = ingredient;

  const maxKcal = positiveInt(params[PARAM.maxKcal]);
  if (maxKcal !== undefined) filter.maxKcal = maxKcal;

  const maxMinutes = positiveInt(params[PARAM.maxMinutes]);
  if (maxMinutes !== undefined) filter.maxMinutes = maxMinutes;

  const rating = firstValue(params[PARAM.rating]);
  if (rating && RATINGS.includes(rating)) filter.rating = rating;

  const category = firstValue(params[PARAM.category]);
  if (category && RECIPE_CATEGORIES.includes(category as RecipeCategory)) {
    filter.category = category as RecipeCategory;
  }

  if (isOn(params[PARAM.simple])) filter.simpleOnly = true;
  if (isOn(params[PARAM.reheatable])) filter.reheatableOnly = true;

  return filter;
}

/**
 * Filter → Query-String (ohne "?"). Leerer Filter ergibt einen leeren String,
 * damit die Seite dann auf ihre nackte URL verlinkt.
 */
export function buildRecipeQuery(filter: RecipeFilter): string {
  const p = new URLSearchParams();
  if (filter.query) p.set(PARAM.query, filter.query);
  for (const tag of filter.tags ?? []) p.append(PARAM.tag, tag);
  if (filter.ingredient) p.set(PARAM.ingredient, filter.ingredient);
  if (filter.maxKcal !== undefined) p.set(PARAM.maxKcal, String(filter.maxKcal));
  if (filter.maxMinutes !== undefined) p.set(PARAM.maxMinutes, String(filter.maxMinutes));
  if (filter.rating) p.set(PARAM.rating, filter.rating);
  if (filter.category) p.set(PARAM.category, filter.category);
  if (filter.simpleOnly) p.set(PARAM.simple, "1");
  if (filter.reheatableOnly) p.set(PARAM.reheatable, "1");
  return p.toString();
}

export const RECIPES_PATH = "/mobile/meals/rezepte";

/** Filter → verlinkbare Adresse der Rezeptseite. */
export function recipesHref(filter: RecipeFilter): string {
  const query = buildRecipeQuery(filter);
  return query ? `${RECIPES_PATH}?${query}` : RECIPES_PATH;
}

/** Denselben Filter mit an-/abgeschaltetem Tag — treibt die Filter-Chips. */
export function toggleTag(filter: RecipeFilter, tag: string): RecipeFilter {
  const current = filter.tags ?? [];
  const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
  const rest = { ...filter };
  delete rest.tags;
  return next.length > 0 ? { ...rest, tags: next } : rest;
}

/** Suchbegriff setzen — ein leerer Begriff entfernt das Feld wieder. */
export function withQuery(filter: RecipeFilter, query: string): RecipeFilter {
  const next = { ...filter };
  const trimmed = query.trim();
  if (trimmed) next.query = trimmed;
  else delete next.query;
  return next;
}

/**
 * Setzt ein einzelnes Filterfeld — oder entfernt es, wenn der Wert dem
 * aktuellen entspricht. Damit schaltet ein zweiter Klick auf denselben Chip
 * den Filter wieder ab.
 */
export function toggleField<K extends keyof RecipeFilter>(
  filter: RecipeFilter,
  key: K,
  value: RecipeFilter[K],
): RecipeFilter {
  if (filter[key] === value) {
    const next = { ...filter };
    delete next[key];
    return next;
  }
  return { ...filter, [key]: value };
}

/** True, wenn überhaupt etwas gefiltert wird (steuert den "alles zeigen"-Knopf). */
export function isFilterActive(filter: RecipeFilter): boolean {
  return buildRecipeQuery(filter) !== "";
}
