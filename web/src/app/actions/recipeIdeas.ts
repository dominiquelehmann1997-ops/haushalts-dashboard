"use server";

// Server-Actions für Claude-generierte Rezept-Ideen (Phase 2). Läuft über die
// `claude` CLI (OAuth-Abo, kein API-Key). Generieren liefert nur Vorschläge;
// erst "übernehmen" schreibt eine `.md` in den Vault + spiegelt sie in die DB.

import { revalidateDashboard } from "@/lib/revalidate";

import { listRecipes } from "@/lib/repositories/meals";
import { getActivePhase } from "@/lib/repositories/phase";
import { ingestVault } from "@/lib/repositories/recipeIngest";
import {
  generateRecipeIdeas,
  saveRecipeIdeaToVault,
  type RecipeIdea,
} from "@/lib/services/recipeIdeas";

export interface IdeasResult {
  ideas: RecipeIdea[];
  error: string | null;
}

/** Generiert `count` Rezept-Ideen via Claude — ohne DB/Vault-Write. */
export async function generateRecipeIdeasAction(count = 3): Promise<IdeasResult> {
  try {
    const [recipes, phase] = await Promise.all([listRecipes(), getActivePhase()]);
    const context = phase?.mode === "elternzeit" ? "Elternzeit – möglichst einfach & schnell" : undefined;
    const ideas = await generateRecipeIdeas(
      recipes.map((r) => r.name),
      { count, context },
    );
    if (ideas.length === 0) {
      return { ideas: [], error: "Claude hat keine verwertbaren Ideen geliefert." };
    }
    return { ideas, error: null };
  } catch (e) {
    return { ideas: [], error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

/** Übernimmt eine Idee: schreibt `.md` in den Vault und spiegelt sie in die DB. */
export async function acceptRecipeIdeaAction(idea: RecipeIdea): Promise<{ ok: boolean; error: string | null }> {
  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) return { ok: false, error: "RECIPE_VAULT_PATH ist nicht gesetzt." };
  try {
    await saveRecipeIdeaToVault(idea, vaultPath);
    const report = await ingestVault(vaultPath);
    revalidateDashboard();
    if (report.errors.length) return { ok: false, error: report.errors.join("; ") };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}
