import { notFound } from "next/navigation";

import { PageHeader } from "@/components/mobile/PageHeader";
import { RecipeEditor } from "@/components/mobile/RecipeEditor";
import { getRecipe } from "@/lib/repositories/recipes";

export const dynamic = "force-dynamic";

export default async function MobileRecipeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  return (
    <div className="space-y-3">
      <PageHeader eyebrow="Rezept bearbeiten" title={recipe.name} />
      <RecipeEditor recipe={recipe} />
    </div>
  );
}
