import { MealDraftPanel } from "@/components/MealDraftPanel";
import { MealPlanControl } from "@/components/MealPlanControl";
import { getDraftMealPlan, getWeekMealPlan, listRecipes } from "@/lib/repositories/meals";
import { PageHeader } from "@/components/mobile/PageHeader";
import { MealWeekList } from "@/components/mobile/MealWeekList";

export const dynamic = "force-dynamic";

export default async function MobileMealsPage() {
  const [meals, draft, recipes] = await Promise.all([
    getWeekMealPlan(),
    getDraftMealPlan(),
    listRecipes(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Steuerung" title="Essensplan" right={<MealPlanControl />} />

      {meals.length > 0 ? (
        <MealWeekList meals={meals} />
      ) : (
        <p className="text-ink-soft dark:text-cream/60 text-[14px]">
          Für diese Woche ist noch kein Essensplan abgenickt.
        </p>
      )}

      {draft && draft.length > 0 && <MealDraftPanel draft={draft} recipes={recipes} />}
    </div>
  );
}
