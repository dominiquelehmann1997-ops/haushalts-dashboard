import { MealDraftPanel } from "@/components/MealDraftPanel";
import { getDraftMealPlan, listRecipes } from "@/lib/repositories/meals";

export const dynamic = "force-dynamic";

export default async function MobileMealsPage() {
  const [draft, recipes] = await Promise.all([
    getDraftMealPlan(),
    listRecipes()
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">Essensplan</h1>
      {/* Wir binden den bestehenden DraftPanel für die Steuerung ein */}
      {draft && draft.length > 0 ? (
        <MealDraftPanel draft={draft} recipes={recipes} />
      ) : (
        <p className="text-slate-400">Aktuell liegt kein Entwurf für diese Woche vor.</p>
      )}
    </div>
  );
}
