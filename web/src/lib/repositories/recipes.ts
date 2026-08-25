// Repository für das Rezeptbuch. Die DB ist die Wahrheit — gepflegt wird in der
// App (früher: Spiegel des Obsidian-Vaults).
//
// Gefiltert wird bewusst in der Anwendung (`recipeSearch.ts`), nicht per SQL:
// siehe die Begründung dort. Deshalb lädt `listRecipes` die Rezepte samt
// Zutaten und filtert danach.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type {
  Recipe,
  RecipeFilter,
  RecipeIngredient,
  RecipeOption,
  RecipeTagCount,
} from "@/lib/domain";
import { parseTags } from "@/lib/services/mealWeights";
import { applyFilters, collectTags } from "@/lib/services/recipeSearch";

/** Eine Zutatenzeile, wie sie beim Anlegen/Bearbeiten hereinkommt. */
export interface RecipeIngredientInput {
  name: string;
  amount?: string | null;
  unit?: string | null;
}

export interface RecipeInput {
  name: string;
  rating?: string;
  simple?: boolean;
  reheatable?: boolean;
  tags?: string[];
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  kcal?: number | null;
  protein?: number | null;
  steps?: string[];
  notes?: string | null;
  sourceUrl?: string | null;
  imagePath?: string | null;
  ingredients?: RecipeIngredientInput[];
}

/** Prisma-Zeile inkl. Zutaten, wie `findMany`/`findUnique` sie hier liefern. */
type RecipeRow = {
  id: string;
  name: string;
  slug: string | null;
  rating: string;
  simple: boolean;
  reheatable: boolean;
  tags: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  kcal: number | null;
  protein: number | null;
  steps: string | null;
  notes: string | null;
  sourceUrl: string | null;
  imagePath: string | null;
  archived: boolean;
  ingredients: { id: string; name: string; amount: string | null; unit: string | null }[];
};

/** `steps` liegt als JSON-String in der DB — kaputte Werte ergeben eine leere Liste, keinen Crash. */
function parseStepsJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Bilddatei → auslieferbare URL. Die Bilder liegen außerhalb von `public/`
 * (sonst würde ein Tablet-Deploy sie überschreiben) und kommen über einen
 * Route-Handler.
 */
function imageUrlOf(imagePath: string | null): string | null {
  return imagePath ? `/api/recipe-image/${encodeURIComponent(imagePath)}` : null;
}

function toRecipe(row: RecipeRow): Recipe {
  const prep = row.prepMinutes;
  const cook = row.cookMinutes;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    rating: row.rating,
    simple: row.simple,
    reheatable: row.reheatable,
    tags: parseTags(row.tags),
    servings: row.servings,
    prepMinutes: prep,
    cookMinutes: cook,
    // Nur null, wenn BEIDE fehlen — ein Rezept mit reiner Kochzeit hat eine
    // brauchbare Gesamtzeit, die im Zeitfilter mitspielen soll.
    totalMinutes: prep === null && cook === null ? null : (prep ?? 0) + (cook ?? 0),
    kcal: row.kcal,
    protein: row.protein,
    steps: parseStepsJson(row.steps),
    notes: row.notes,
    sourceUrl: row.sourceUrl,
    imageUrl: imageUrlOf(row.imagePath),
    archived: row.archived,
    ingredients: row.ingredients.map(
      (i): RecipeIngredient => ({ id: i.id, name: i.name, amount: i.amount, unit: i.unit }),
    ),
  };
}

const INCLUDE_INGREDIENTS = { ingredients: { orderBy: { sort: "asc" } } } as const;

/**
 * Alle nicht archivierten Rezepte, alphabetisch, optional gefiltert.
 * Ohne `filter` ist das schlicht das ganze Rezeptbuch.
 */
export async function listRecipes(
  filter: RecipeFilter = {},
  client: PrismaClient = prisma,
): Promise<Recipe[]> {
  const rows = await client.recipe.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    include: INCLUDE_INGREDIENTS,
  });
  return applyFilters(rows.map(toRecipe), filter);
}

/**
 * Schlanke `{id, name}`-Liste für die Rezept-Auswahl im Essensplan. Bewusst
 * getrennt von `listRecipes`: die Dropdowns brauchen weder Zutaten noch Filter.
 */
export async function listRecipeOptions(client: PrismaClient = prisma): Promise<RecipeOption[]> {
  const recipes = await client.recipe.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return recipes.map((r) => ({ id: r.id, name: r.name }));
}

/** Ein Rezept samt Zutaten; `null`, wenn es die id nicht (mehr) gibt. */
export async function getRecipe(id: string, client: PrismaClient = prisma): Promise<Recipe | null> {
  const row = await client.recipe.findUnique({ where: { id }, include: INCLUDE_INGREDIENTS });
  return row ? toRecipe(row) : null;
}

/** Tagliste mit Häufigkeit über alle aktiven Rezepte — für die Filter-Chips. */
export async function listRecipeTags(client: PrismaClient = prisma): Promise<RecipeTagCount[]> {
  const rows = await client.recipe.findMany({
    where: { archived: false },
    select: { tags: true },
  });
  return collectTags(rows.map((r) => ({ tags: parseTags(r.tags) }) as Recipe));
}

/** Feldwerte aus dem Input, gemeinsam für create und update. */
function scalarFields(input: RecipeInput) {
  return {
    name: input.name.trim(),
    rating: input.rating ?? "ok",
    simple: input.simple ?? true,
    reheatable: input.reheatable ?? false,
    tags: input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null,
    servings: input.servings ?? null,
    prepMinutes: input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes ?? null,
    kcal: input.kcal ?? null,
    protein: input.protein ?? null,
    steps: input.steps && input.steps.length > 0 ? JSON.stringify(input.steps) : null,
    notes: input.notes ?? null,
    sourceUrl: input.sourceUrl ?? null,
    imagePath: input.imagePath ?? null,
  };
}

function ingredientRows(recipeId: string, ingredients: RecipeIngredientInput[] = []) {
  return ingredients
    .filter((i) => i.name.trim() !== "")
    .map((i, index) => ({
      recipeId,
      name: i.name.trim(),
      amount: i.amount?.trim() || null,
      unit: i.unit?.trim() || null,
      sort: index,
    }));
}

/** Legt ein Rezept an. `slug` bleibt null — den vergibt nur der Import. */
export async function createRecipe(
  input: RecipeInput,
  client: PrismaClient = prisma,
): Promise<{ id: string }> {
  const created = await client.recipe.create({
    data: scalarFields(input),
    select: { id: true },
  });
  for (const row of ingredientRows(created.id, input.ingredients)) {
    await client.ingredient.create({ data: row });
  }
  return { id: created.id };
}

/**
 * Überschreibt ein Rezept vollständig. Die Zutaten werden ersetzt, nicht
 * gemergt — das Formular schickt immer die komplette Liste, und `sort` folgt
 * ihrer Reihenfolge.
 */
export async function updateRecipe(
  id: string,
  input: RecipeInput,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.recipe.update({ where: { id }, data: scalarFields(input) });
  await client.ingredient.deleteMany({ where: { recipeId: id } });
  for (const row of ingredientRows(id, input.ingredients)) {
    await client.ingredient.create({ data: row });
  }
}

export interface RecipeRemoval {
  /** true = endgültig gelöscht, false = nur archiviert (noch verplant). */
  deleted: boolean;
}

/**
 * Entfernt ein Rezept aus dem Rezeptbuch. Hängt es noch in einem Essensplan,
 * wird es nur archiviert: `MealPlanEntry.recipeId` ist ein Fremdschlüssel, ein
 * harter Delete würde zur Laufzeit scheitern und die Wochenhistorie zerreißen.
 */
export async function deleteRecipe(
  id: string,
  client: PrismaClient = prisma,
): Promise<RecipeRemoval> {
  const planned = await client.mealPlanEntry.count({ where: { recipeId: id } });
  if (planned > 0) {
    await client.recipe.update({ where: { id }, data: { archived: true } });
    return { deleted: false };
  }
  await client.ingredient.deleteMany({ where: { recipeId: id } });
  await client.recipe.delete({ where: { id } });
  return { deleted: true };
}

/** Bewertung setzen — der häufigste Einzel-Edit, deshalb ein eigener Weg. */
export async function setRecipeRating(
  id: string,
  rating: string,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.recipe.update({ where: { id }, data: { rating } });
}
