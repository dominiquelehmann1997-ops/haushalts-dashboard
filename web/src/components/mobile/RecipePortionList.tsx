"use client";

// Zutatenliste der Kochansicht mit Portionsregler. Client-Komponente, weil
// sich die Mengen beim Schieben live ändern sollen — gerechnet wird in
// `portions.ts` (rein und getestet).
//
// Ohne Portionsangabe am Rezept wird nicht gerechnet: Der Regler bleibt weg
// und die Zutaten stehen so da, wie sie im Rezept stehen.

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import type { RecipeIngredient } from "@/lib/domain";
import { groupIngredientsBySection } from "@/lib/services/ingredientGroups";
import { clampPortions, MAX_PORTIONS, MIN_PORTIONS, scaleIngredients } from "@/lib/services/portions";

const STEP_BUTTON =
  "w-8 h-8 grid place-items-center rounded-full bg-white/70 dark:bg-white/[0.08] " +
  "text-ink-soft dark:text-cream/70 disabled:opacity-35 disabled:cursor-not-allowed " +
  "hover:bg-white dark:hover:bg-white/[0.14] transition-colors";

export function RecipePortionList({
  ingredients,
  servings,
}: {
  ingredients: RecipeIngredient[];
  servings: number | null;
}) {
  const [portions, setPortions] = useState(() => clampPortions(servings ?? MIN_PORTIONS));

  const scalable = servings !== null && servings > 0;
  const shown = scalable ? scaleIngredients(ingredients, servings, portions) : ingredients;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
          Zutaten
        </h2>

        {scalable && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPortions((p) => clampPortions(p - 1))}
              disabled={portions <= MIN_PORTIONS}
              aria-label="Eine Portion weniger"
              className={STEP_BUTTON}
            >
              <Minus size={14} strokeWidth={2.4} />
            </button>
            <span
              aria-live="polite"
              className="min-w-[5.5rem] text-center text-[12.5px] font-semibold text-ink dark:text-cream/90"
            >
              {portions} {portions === 1 ? "Portion" : "Portionen"}
            </span>
            <button
              type="button"
              onClick={() => setPortions((p) => clampPortions(p + 1))}
              disabled={portions >= MAX_PORTIONS}
              aria-label="Eine Portion mehr"
              className={STEP_BUTTON}
            >
              <Plus size={14} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </div>

      {shown.length > 0 ? (
        // Ohne Gruppen bleibt es eine einzige Liste — dann rendert die Schleife
        // genau eine Gruppe ohne Überschrift, also exakt wie vorher.
        <div className="space-y-3">
          {groupIngredientsBySection(shown).map((gruppe, index) => (
            <div key={gruppe.section ?? `ohne-gruppe-${index}`}>
              {gruppe.section && (
                <h3 className="pb-1 text-[11.5px] font-semibold text-ink-soft dark:text-cream/70">
                  {gruppe.section}
                </h3>
              )}
              <ul className="divide-y divide-ink/5 dark:divide-white/5">
                {gruppe.items.map((i) => (
                  <li key={i.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="text-[13.5px] text-ink dark:text-cream/85">{i.name}</span>
                    <span className="shrink-0 text-[13px] text-ink-soft dark:text-cream/60 tabular-nums">
                      {[i.amount, i.unit].filter(Boolean).join(" ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-ink-faint">Für dieses Rezept sind keine Zutaten hinterlegt.</p>
      )}

      {!scalable && ingredients.length > 0 && (
        <p className="text-[11.5px] text-ink-faint">
          Ohne Portionsangabe lässt sich nicht umrechnen — im Rezept eintragen, dann geht der Regler.
        </p>
      )}
    </section>
  );
}
