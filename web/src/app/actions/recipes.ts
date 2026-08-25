"use server";

// Server-Actions rund um das Rezeptbuch: Anlegen, Bearbeiten, Löschen,
// Bewerten und der Import per Link. Die DB ist die Wahrheit — geschrieben wird
// ausschließlich über `repositories/recipes`, hier steht keine Prisma-Query.
//
// `ingestVaultAction` ist der letzte Rest des Obsidian-Wegs und fliegt mit dem
// Vault-Ausbau raus (Phase 7 des Umsetzungsplans).

import { revalidatePath } from "next/cache";

import { revalidateDashboard } from "@/lib/revalidate";

import { ingestVault, type IngestReport } from "@/lib/repositories/recipeIngest";
import {
  createRecipe,
  deleteRecipe,
  setRecipeRating,
  updateRecipe,
  upsertImportedRecipe,
  type RecipeInput,
  type RecipeRemoval,
} from "@/lib/repositories/recipes";
import { importRecipeFromUrl } from "@/lib/services/recipeImport";

/**
 * Wie `revalidateDashboard`, nimmt aber die Rezept-Detailseiten mit. Die
 * stehen unter einem dynamischen Segment und sind deshalb in der festen
 * Pfadliste nicht abgedeckt.
 */
function revalidateRecipes(): void {
  revalidateDashboard();
  revalidatePath("/mobile/meals/rezepte/[id]", "page");
}

export async function ingestVaultAction(): Promise<IngestReport> {
  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) {
    return { imported: 0, archived: 0, errors: ["RECIPE_VAULT_PATH ist nicht gesetzt."] };
  }
  const report = await ingestVault(vaultPath);
  revalidateRecipes();
  return report;
}

/** Legt ein Rezept an und liefert seine id — die Detailseite wird danach angesteuert. */
export async function createRecipeAction(input: RecipeInput): Promise<{ id: string }> {
  const created = await createRecipe(input);
  revalidateRecipes();
  return created;
}

export async function updateRecipeAction(id: string, input: RecipeInput): Promise<void> {
  await updateRecipe(id, input);
  revalidateRecipes();
}

/**
 * Entfernt ein Rezept. Hängt es noch in einem Essensplan, wird es nur
 * archiviert (`deleted: false`) — die Wochenhistorie bleibt lesbar.
 */
export async function deleteRecipeAction(id: string): Promise<RecipeRemoval> {
  const removal = await deleteRecipe(id);
  revalidateRecipes();
  return removal;
}

export async function setRecipeRatingAction(id: string, rating: string): Promise<void> {
  await setRecipeRating(id, rating);
  revalidateRecipes();
}

export interface RecipeUrlImportResult {
  ok: boolean;
  /** id des Rezepts in der DB — für den Sprung auf die Detailseite. */
  id: string | null;
  name: string | null;
  kcal: number | null;
  ingredientCount: number;
  updated: boolean;
  error: string | null;
}

/**
 * Importiert ein Rezept per Link direkt in die DB: Seite holen, schema.org
 * lesen, anlegen oder das bestehende Rezept aktualisieren (Dedupe über die
 * Quell-URL, sonst über den Slug).
 */
export async function importRecipeUrlAction(url: string): Promise<RecipeUrlImportResult> {
  try {
    const recipe = await importRecipeFromUrl(url);
    const { id, updated } = await upsertImportedRecipe(recipe);
    revalidateRecipes();
    return {
      ok: true,
      id,
      name: recipe.name,
      kcal: recipe.kcal,
      ingredientCount: recipe.ingredients.length,
      updated,
      error: null,
    };
  } catch (e) {
    return {
      ok: false,
      id: null,
      name: null,
      kcal: null,
      ingredientCount: 0,
      updated: false,
      error: e instanceof Error ? e.message : "Unbekannter Fehler",
    };
  }
}
