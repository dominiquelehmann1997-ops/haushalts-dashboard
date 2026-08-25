import Link from "next/link";

import { MealDraftPanel } from "@/components/MealDraftPanel";
import { MealPlanControl } from "@/components/MealPlanControl";
import { RecipeIdeasControl } from "@/components/RecipeIdeasControl";
import { RecipeUrlImport } from "@/components/RecipeUrlImport";
import { getDraftMealPlan, getWeekMealPlan } from "@/lib/repositories/meals";
import { listRecipeOptions } from "@/lib/repositories/recipes";
import { hasCalendarDataForWeek } from "@/lib/repositories/calendar";
import { PageHeader } from "@/components/mobile/PageHeader";
import { MealWeekList } from "@/components/mobile/MealWeekList";
import { MealWeekNav } from "@/components/mobile/MealWeekNav";
import { weekOffsetLabel, weekStartWithOffset } from "@/lib/dates";
import { clampWeekOffset } from "@/lib/weekOffset";

export const dynamic = "force-dynamic";

export default async function MobileMealsPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  // `?w=<offset>` wählt die ISO-Woche relativ zur laufenden (0 = diese, 1 = die
  // nächste) — so lässt sich vorausgeplant werden, bevor die Woche startet.
  const { w } = await searchParams;
  const offset = clampWeekOffset(Number(w ?? 0));
  const weekStart = weekStartWithOffset(offset);
  const weekStartISO = weekStart.toISOString();
  const weekLabel = weekOffsetLabel(offset);

  const [meals, draft, recipes, hasShiftData] = await Promise.all([
    getWeekMealPlan(undefined, weekStart),
    getDraftMealPlan(undefined, weekStart),
    listRecipeOptions(),
    hasCalendarDataForWeek(weekStart),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Steuerung"
        title="Essensplan"
        right={
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/mobile/meals/rezepte"
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                         bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70
                         hover:bg-cream dark:hover:bg-white/[0.1] transition-colors"
            >
              Rezepte
            </Link>
            <MealPlanControl weekStartISO={weekStartISO} />
          </div>
        }
      />

      <MealWeekNav offset={offset} />

      {!hasShiftData && (
        <p className="text-[12.5px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-2xl px-3 py-2">
          Für diese Woche sind noch keine Kalendertermine synchronisiert — ein Entwurf
          kennt Domes Dienstplan dann nicht und plant ohne Schicht-Constraints.
        </p>
      )}

      {meals.length > 0 ? (
        <MealWeekList meals={meals} recipes={recipes} />
      ) : (
        <p className="text-ink-soft dark:text-cream/60 text-[14px]">
          {`Für ${weekLabel.toLowerCase()} ist noch kein Essensplan abgenickt.`}
        </p>
      )}

      {draft && draft.length > 0 && (
        <MealDraftPanel
          draft={draft}
          recipes={recipes}
          weekStartISO={weekStartISO}
          weekLabel={weekLabel}
        />
      )}

      <RecipeUrlImport />

      <RecipeIdeasControl />
    </div>
  );
}
