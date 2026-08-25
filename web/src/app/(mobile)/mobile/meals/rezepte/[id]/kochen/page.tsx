import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/mobile/PageHeader";
import { RecipeCookView } from "@/components/mobile/RecipeCookView";
import { getRecipe } from "@/lib/repositories/recipes";
import { RECIPES_PATH } from "@/lib/recipeFilterParams";

export const dynamic = "force-dynamic";

// Eigene Route statt Umschalter auf der Detailseite: so ist die Kochansicht
// verlinkbar, der Zurück-Knopf führt zurück ins Rezept, und sie darf ihr
// eigenes Layout mit fester Höhe haben, ohne die Detailseite zu verbiegen.
export default async function MobileRecipeCookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Kochansicht"
        title={recipe.name}
        right={
          <Link
            href={`${RECIPES_PATH}/${recipe.id}`}
            className="shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                       bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70
                       hover:bg-cream dark:hover:bg-white/[0.1] transition-colors"
          >
            Zurück
          </Link>
        }
      />
      <RecipeCookView recipe={recipe} />
    </div>
  );
}
