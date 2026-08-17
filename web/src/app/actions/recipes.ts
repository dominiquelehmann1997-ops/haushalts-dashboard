"use server";

// Server-Action: liest den Rezepte-Vault (Pfad aus RECIPE_VAULT_PATH) ein und
// spiegelt ihn in die DB. Manuell ausgelöst über den VaultIngestControl-Button.

import { revalidateDashboard } from "@/lib/revalidate";

import { ingestVault, type IngestReport } from "@/lib/repositories/recipeIngest";
import { importRecipeFromUrl } from "@/lib/services/recipeImport";

export async function ingestVaultAction(): Promise<IngestReport> {
  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) {
    return { imported: 0, archived: 0, errors: ["RECIPE_VAULT_PATH ist nicht gesetzt."] };
  }
  const report = await ingestVault(vaultPath);
  revalidateDashboard();
  return report;
}

export interface RecipeUrlImportResult {
  ok: boolean;
  /** Rezeptname bei Erfolg. */
  name: string | null;
  kcal: number | null;
  ingredientCount: number;
  updated: boolean;
  error: string | null;
}

/**
 * Importiert ein Rezept per Link: schreibt die `.md` in den Vault und spiegelt
 * ihn direkt in die DB — damit das Rezept sofort im Essensplan wählbar ist.
 */
export async function importRecipeUrlAction(url: string): Promise<RecipeUrlImportResult> {
  const failed = (error: string): RecipeUrlImportResult => ({
    ok: false,
    name: null,
    kcal: null,
    ingredientCount: 0,
    updated: false,
    error,
  });

  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) return failed("RECIPE_VAULT_PATH ist nicht gesetzt.");

  try {
    const { recipe, updated } = await importRecipeFromUrl(url, vaultPath);
    const report = await ingestVault(vaultPath);
    revalidateDashboard();
    return {
      ok: true,
      name: recipe.name,
      kcal: recipe.kcal,
      ingredientCount: recipe.ingredients.length,
      updated,
      error: report.errors.length > 0 ? report.errors.join("; ") : null,
    };
  } catch (e) {
    return failed(e instanceof Error ? e.message : "Unbekannter Fehler");
  }
}
