"use server";

// Server-Action: liest den Rezepte-Vault (Pfad aus RECIPE_VAULT_PATH) ein und
// spiegelt ihn in die DB. Manuell ausgelöst über den VaultIngestControl-Button.

import { revalidatePath } from "next/cache";

import { ingestVault, type IngestReport } from "@/lib/repositories/recipeIngest";

export async function ingestVaultAction(): Promise<IngestReport> {
  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) {
    return { imported: 0, archived: 0, errors: ["RECIPE_VAULT_PATH ist nicht gesetzt."] };
  }
  const report = await ingestVault(vaultPath);
  revalidatePath("/");
  return report;
}
