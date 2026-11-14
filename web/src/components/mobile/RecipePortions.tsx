"use client";

// Gemeinsamer Portionszustand der Rezept-Detailseite. Der Regler sitzt in der
// Zutatenliste, gebraucht wird die Zahl aber auch vom Koch-Link (damit die
// Kochansicht mit derselben Portionszahl öffnet statt mit der Originalmenge)
// und vom Bring-Knopf (damit die hochgerechneten Mengen auf die Liste gehen).
// Übergeben wird die Zahl an die Kochansicht als `?portionen=N`.

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { ChefHat, ShoppingCart } from "lucide-react";

import { pushRecipeIngredientsAction } from "@/app/actions/recipes";
import type { BringPushResult } from "@/integrations/bring/client";
import { RECIPES_PATH } from "@/lib/recipeFilterParams";
import { clampPortions, MIN_PORTIONS, PORTIONS_PARAM, scaleIngredients } from "@/lib/services/portions";
import type { RecipeIngredient } from "@/lib/domain";

type PortionsState = {
  servings: number | null;
  portions: number;
  setPortions: (update: (p: number) => number) => void;
};

const PortionsContext = createContext<PortionsState | null>(null);

export function RecipePortionsProvider({
  servings,
  initialPortions,
  children,
}: {
  servings: number | null;
  initialPortions?: number | null;
  children: ReactNode;
}) {
  const [portions, setRaw] = useState(() =>
    clampPortions(initialPortions ?? servings ?? MIN_PORTIONS),
  );
  const setPortions = (update: (p: number) => number) => setRaw((p) => clampPortions(update(p)));
  return (
    <PortionsContext.Provider value={{ servings, portions, setPortions }}>{children}</PortionsContext.Provider>
  );
}

export function useRecipePortions(): PortionsState {
  const ctx = useContext(PortionsContext);
  if (!ctx) throw new Error("useRecipePortions braucht einen RecipePortionsProvider");
  return ctx;
}

/** Nur wenn vom Rezept abweichend, landet die Portionszahl in der URL. */
function portionsQuery(servings: number | null, portions: number): string {
  if (servings === null || servings <= 0 || portions === servings) return "";
  return `?${PORTIONS_PARAM}=${portions}`;
}

export function RecipeCookLink({ recipeId }: { recipeId: string }) {
  const { servings, portions } = useRecipePortions();
  return (
    <Link
      href={`${RECIPES_PATH}/${recipeId}/kochen${portionsQuery(servings, portions)}`}
      className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                 bg-dome-deep/10 dark:bg-dome/15 text-dome-deep dark:text-dome
                 hover:bg-dome-deep/15 dark:hover:bg-dome/25 transition-colors"
    >
      <ChefHat size={11} strokeWidth={2.2} />
      Kochen
    </Link>
  );
}

function ingredientLine(i: RecipeIngredient): string {
  const amount = [i.amount, i.unit].filter(Boolean).join(" ");
  return amount ? `• ${i.name} — ${amount}` : `• ${i.name}`;
}

/** Pusht die (auf die gewählte Portionszahl umgerechneten) Zutaten auf Bring. */
export function RecipeBringButton({
  recipeId,
  ingredients,
}: {
  recipeId: string;
  ingredients: RecipeIngredient[];
}) {
  const { servings, portions } = useRecipePortions();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ bring: BringPushResult; portions: number } | null>(null);
  const [copied, setCopied] = useState(false);

  if (ingredients.length === 0) return null;

  const scalable = servings !== null && servings > 0;
  // Erfolg gilt nur für die Portionszahl, mit der gepusht wurde.
  const pushed = result?.bring.ok === true && result.portions === portions;
  const failed = result !== null && !result.bring.ok;

  const push = () => {
    setCopied(false);
    startTransition(async () => {
      const res = await pushRecipeIngredientsAction(recipeId, scalable ? portions : null);
      setResult({ bring: res.bring, portions });
    });
  };

  const copy = () => {
    const shown = scalable ? scaleIngredients(ingredients, servings, portions) : ingredients;
    const text = shown.map(ingredientLine).join("\n");
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={push}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                    transition-colors disabled:cursor-wait ${
                      pushed
                        ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "text-sky-700 bg-sky-50 dark:bg-sky-500/15 dark:text-sky-300 hover:bg-sky-100"
                    }`}
      >
        <ShoppingCart size={11} strokeWidth={2.2} />
        {pending
          ? "…"
          : pushed
            ? "✓ Auf Bring gepusht"
            : scalable
              ? `Zutaten für ${portions} ${portions === 1 ? "Portion" : "Portionen"} auf Bring`
              : "Zutaten auf Bring pushen"}
      </button>
      {failed && (
        <button
          type="button"
          onClick={copy}
          className="text-[11px] font-semibold text-ink-faint hover:text-ink-soft underline decoration-dotted underline-offset-2"
        >
          {copied ? "Zutaten kopiert ✓" : "Bring fehlte — Zutaten zum Einfügen kopieren"}
        </button>
      )}
    </div>
  );
}
