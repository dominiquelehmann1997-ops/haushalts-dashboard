"use server";

// Server-Actions für Claude-generierte Rezept-Ideen. Läuft über die `claude`
// CLI (OAuth-Abo, kein API-Key). Generieren liefert nur Vorschläge; erst
// "übernehmen" schreibt das Rezept in die DB — über denselben Upsert wie der
// Link-Import, damit ein zweimal übernommener Vorschlag keine Dublette wird.

import { revalidateDashboard } from "@/lib/revalidate";

import { listRecipeOptions, upsertImportedRecipe } from "@/lib/repositories/recipes";
import { getActivePhase } from "@/lib/repositories/phase";
import {
  generateRecipeIdeas,
  recipeIdeaToImported,
  type RecipeIdea,
} from "@/lib/services/recipeIdeas";

export interface IdeasResult {
  ideas: RecipeIdea[];
  error: string | null;
}

/** Generiert `count` Rezept-Ideen via Claude — ohne DB-Write. */
export async function generateRecipeIdeasAction(count = 3): Promise<IdeasResult> {
  try {
    const [recipes, phase] = await Promise.all([listRecipeOptions(), getActivePhase()]);
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

export interface AcceptIdeaResult {
  ok: boolean;
  /** id des angelegten Rezepts — für den Sprung auf die Detailseite. */
  id: string | null;
  error: string | null;
}

/** Übernimmt eine Idee als Rezept in die DB. */
export async function acceptRecipeIdeaAction(idea: RecipeIdea): Promise<AcceptIdeaResult> {
  try {
    const { id } = await upsertImportedRecipe(recipeIdeaToImported(idea));
    revalidateDashboard();
    return { ok: true, id, error: null };
  } catch (e) {
    return { ok: false, id: null, error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}
