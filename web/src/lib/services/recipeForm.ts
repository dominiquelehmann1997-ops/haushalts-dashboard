// Formular-Zustand des Rezept-Editors und seine Übersetzung nach `RecipeInput`.
// Rein und ohne React/Prisma, damit die ganze Umrechnerei getestet ist und im
// Editor selbst nur noch Eingabefelder und ein `startTransition` stehen.
//
// Im Formular ist jedes Feld ein String — auch Zahlen. Ein `<input>` liefert
// nun einmal Strings, und ein halb getipptes Feld ("1", während "15" gemeint
// ist) darf nicht schon beim Tippen zu einer Zahl gerundet werden.

import type { Recipe, RecipeCategory } from "@/lib/domain";
import type { RecipeInput } from "@/lib/repositories/recipes";

export interface RecipeDraftIngredient {
  name: string;
  amount: string;
  unit: string;
  section: string | null;
}

export interface RecipeDraft {
  name: string;
  rating: string;
  simple: boolean;
  reheatable: boolean;
  /** Komma-getrennt — im Formular ein einzelnes Feld. */
  tags: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  /** Ein Schritt pro Zeile. */
  steps: string;
  notes: string;
  sourceUrl: string;
  category: RecipeCategory;
  ingredients: RecipeDraftIngredient[];
}

export const RATINGS = ["favorit", "ok", "selten"] as const;

export const EMPTY_INGREDIENT: RecipeDraftIngredient = { name: "", amount: "", unit: "", section: null };

/** Leeres Formular für „neues Rezept" — mit einer leeren Zutatenzeile. */
export function emptyDraft(): RecipeDraft {
  return {
    name: "",
    rating: "ok",
    simple: true,
    reheatable: false,
    tags: "",
    servings: "",
    prepMinutes: "",
    cookMinutes: "",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
    steps: "",
    notes: "",
    sourceUrl: "",
    category: "hauptmahlzeit",
    ingredients: [{ ...EMPTY_INGREDIENT }],
  };
}

function numberField(value: number | null): string {
  return value === null ? "" : String(value);
}

/** Bestehendes Rezept → Formularzustand. */
export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    rating: recipe.rating,
    simple: recipe.simple,
    reheatable: recipe.reheatable,
    tags: recipe.tags.join(", "),
    servings: numberField(recipe.servings),
    prepMinutes: numberField(recipe.prepMinutes),
    cookMinutes: numberField(recipe.cookMinutes),
    kcal: numberField(recipe.kcal),
    protein: numberField(recipe.protein),
    carbs: numberField(recipe.carbs),
    fat: numberField(recipe.fat),
    steps: recipe.steps.join("\n"),
    notes: recipe.notes ?? "",
    sourceUrl: recipe.sourceUrl ?? "",
    category: recipe.category,
    ingredients:
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((i) => ({
            name: i.name,
            amount: i.amount ?? "",
            unit: i.unit ?? "",
            section: i.section ?? null,
          }))
        : [{ ...EMPTY_INGREDIENT }],
  };
}

/**
 * Zahlenfeld → Zahl oder `null`. Negatives und Unsinn werden zu `null`: eine
 * leere Angabe ist ehrlicher als eine falsche, und die Anzeige kommt mit
 * `null` überall zurecht.
 */
export function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/** "curry, vegan , curry" → ["curry", "vegan"] (klein, entdoppelt). */
export function parseTagInput(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/**
 * Textblock → Schrittliste, eine Zeile pro Schritt. Führende Nummerierung
 * ("1. ", "2) ", "- ") fliegt raus: sie kommt beim Kopieren aus einer
 * Rezeptseite mit und würde sonst doppelt angezeigt.
 */
export function splitSteps(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+\s*[.)]|[-*•])\s*/, "").trim())
    .filter((line) => line !== "");
}

/** Formular → Repository-Input. */
export function draftToInput(draft: RecipeDraft): RecipeInput {
  return {
    name: draft.name.trim(),
    rating: draft.rating,
    simple: draft.simple,
    reheatable: draft.reheatable,
    tags: parseTagInput(draft.tags),
    servings: parseOptionalInt(draft.servings),
    prepMinutes: parseOptionalInt(draft.prepMinutes),
    cookMinutes: parseOptionalInt(draft.cookMinutes),
    kcal: parseOptionalInt(draft.kcal),
    protein: parseOptionalInt(draft.protein),
    carbs: parseOptionalInt(draft.carbs),
    fat: parseOptionalInt(draft.fat),
    steps: splitSteps(draft.steps),
    notes: draft.notes.trim() || null,
    sourceUrl: draft.sourceUrl.trim() || null,
    category: draft.category,
    ingredients: draft.ingredients
      .filter((i) => i.name.trim() !== "")
      .map((i) => ({
        name: i.name.trim(),
        amount: i.amount.trim() || null,
        unit: i.unit.trim() || null,
        section: i.section,
      })),
  };
}

/** Warum das Formular (noch) nicht speicherbar ist — `null`, wenn es passt. */
export function draftError(draft: RecipeDraft): string | null {
  if (draft.name.trim() === "") return "Das Rezept braucht einen Namen.";
  return null;
}

/** Element von `from` nach `to` schieben; unmögliche Ziele lassen die Liste in Ruhe. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
