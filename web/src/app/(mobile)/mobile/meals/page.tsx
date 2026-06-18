import { MealDraftPanel } from "@/components/MealDraftPanel";
import { getDraftMealPlan, listRecipes } from "@/lib/repositories/meals";
import { PageHeader } from "@/components/mobile/PageHeader";

export const dynamic = "force-dynamic";

export default async function MobileMealsPage() {
  const [draft, recipes] = await Promise.all([getDraftMealPlan(), listRecipes()]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Steuerung" title="Essensplan" />
      {draft && draft.length > 0 ? (
        <MealDraftPanel draft={draft} recipes={recipes} />
      ) : (
        <p className="text-ink-soft dark:text-cream/60 text-[14px]">Aktuell liegt kein Entwurf für diese Woche vor.</p>
      )}
    </div>
  );
}
