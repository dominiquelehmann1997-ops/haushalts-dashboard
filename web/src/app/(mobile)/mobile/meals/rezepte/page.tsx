import Link from "next/link";

import { PageHeader } from "@/components/mobile/PageHeader";
import { RecipeCard } from "@/components/mobile/RecipeCard";
import { RecipeFilterChips } from "@/components/mobile/RecipeFilterChips";
import { RecipeSearchBar } from "@/components/mobile/RecipeSearchBar";
import { listRecipeTags, listRecipes } from "@/lib/repositories/recipes";
import {
  isFilterActive,
  parseRecipeFilter,
  RECIPES_PATH,
  type RawSearchParams,
} from "@/lib/recipeFilterParams";

export const dynamic = "force-dynamic";

export default async function MobileRecipesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Der Filterzustand steht in der URL (siehe recipeFilterParams) und wird
  // serverseitig angewandt — die Liste kommt fertig gefiltert beim Handy an.
  const filter = parseRecipeFilter(await searchParams);

  const [recipes, tags] = await Promise.all([listRecipes(filter), listRecipeTags()]);
  const gefiltert = isFilterActive(filter);

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Essen"
        title="Rezepte"
        right={
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href={`${RECIPES_PATH}/neu`}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                         bg-ink text-cream dark:bg-cream dark:text-ink
                         hover:opacity-90 transition-opacity"
            >
              + Neu
            </Link>
            <Link
              href="/mobile/meals"
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                         bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70
                         hover:bg-cream dark:hover:bg-white/[0.1] transition-colors"
            >
              Essensplan
            </Link>
          </div>
        }
      />

      <RecipeSearchBar filter={filter} />
      <RecipeFilterChips filter={filter} tags={tags} />

      <div className="flex items-center justify-between text-[11.5px] text-ink-faint pt-1">
        <span>
          {recipes.length} {recipes.length === 1 ? "Rezept" : "Rezepte"}
        </span>
        {gefiltert && (
          <Link href={RECIPES_PATH} className="font-semibold hover:text-ink-soft dark:hover:text-cream/70">
            Filter zurücksetzen
          </Link>
        )}
      </div>

      {recipes.length > 0 ? (
        <ul className="space-y-2">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft dark:text-cream/60 text-[13.5px] py-6 text-center">
          {gefiltert
            ? "Kein Rezept passt zu diesen Filtern."
            : "Noch keine Rezepte — oben rechts eins anlegen, oder auf der Essensplan-Seite eins per Link übernehmen."}
        </p>
      )}
    </div>
  );
}
