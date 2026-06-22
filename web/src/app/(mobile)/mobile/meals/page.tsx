import { MealDraftPanel } from "@/components/MealDraftPanel";
import { MealPlanControl } from "@/components/MealPlanControl";
import { getDraftMealPlan, listRecipes } from "@/lib/repositories/meals";
import { PageHeader } from "@/components/mobile/PageHeader";

export const dynamic = "force-dynamic";

export default async function MobileMealsPage() {
  const [draft, recipes] = await Promise.all([getDraftMealPlan(), listRecipes()]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Steuerung" title="Essensplan" />
      <div className="flex justify-end">
        <MealPlanControl />
      </div>
      {draft && draft.length > 0 ? (
        <MealDraftPanel draft={draft} recipes={recipes} />
      ) : (
        <p className="text-ink-soft dark:text-cream/60 text-[14px]">
          Aktuell liegt kein Entwurf für diese Woche vor. Tippe oben auf „Woche neu planen", um einen Entwurf zu erstellen.
        </p>
      )}
    </div>
  );
}
