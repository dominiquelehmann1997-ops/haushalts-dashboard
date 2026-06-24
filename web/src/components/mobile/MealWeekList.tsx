// Mobile-Ansicht des aktiven Wochen-Essensplans. Spiegelt die Desktop-Kachel
// `MealPlanWidget`, ist aber für die schmale Handy-Spalte optimiert (kein
// festes Höhen-/Scroll-Layout, da die Seite ohnehin scrollt).

import type { Meal } from "@/lib/data";
import { Card } from "@/components/ui";
import { MealReasonBadge } from "@/components/widgets";

export function MealWeekList({ meals }: { meals: Meal[] }) {
  return (
    <Card>
      <ul className="space-y-1.5">
        {meals.map((m) => (
          <li
            key={m.day}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${
              m.today ? "bg-emely-tint dark:bg-emely/12 ring-1 ring-emely/25" : "bg-cream/60 dark:bg-white/[0.03]"
            }`}
          >
            <span
              className={`shrink-0 w-9 h-9 rounded-full grid place-items-center font-display font-semibold text-[13px] ${
                m.today ? "bg-emely text-white" : "bg-white dark:bg-white/10 text-ink-soft dark:text-cream/60"
              }`}
            >
              {m.day}
            </span>
            <span
              className={`flex-1 min-w-0 text-[14.5px] ${
                m.today ? "font-semibold text-ink dark:text-cream" : "text-ink-soft dark:text-cream/70"
              } ${m.light ? "italic" : ""}`}
            >
              {m.dish}
            </span>
            <MealReasonBadge reason={m.reason} extraPortion={m.extraPortion} />
            {m.today && (
              <span className="ml-auto text-[10.5px] font-bold tracking-wide uppercase text-emely-deep dark:text-emely">
                Heute
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
