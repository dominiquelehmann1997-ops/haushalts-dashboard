"use client";

// Bewertung und Löschen auf der Rezept-Detailseite. Die Bewertung ist der
// häufigste Einzel-Edit und soll nicht den Umweg über das Formular nehmen.
//
// Gelöscht wird in zwei Schritten: der erste Tipp fragt nach. Ein `confirm()`
// wäre auf dem Tablet-Kiosk unschön, und ein versehentlicher Tipp darf kein
// Rezept kosten.

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";

import { deleteRecipeAction, setRecipeRatingAction } from "@/app/actions/recipes";
import { RATINGS } from "@/lib/services/recipeForm";
import { RECIPES_PATH } from "@/lib/recipeFilterParams";

const PILL =
  "inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full transition-colors";
const OFF =
  "bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70 hover:bg-cream dark:hover:bg-white/[0.1]";
const ON = "bg-dome-deep dark:bg-dome text-white dark:text-[#26241F]";

const RATING_LABEL: Record<string, string> = {
  favorit: "Favorit",
  ok: "Ok",
  selten: "Selten",
};

export function RecipeDetailActions({ id, rating }: { id: string; rating: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(rating);
  const [confirming, setConfirming] = useState(false);
  const [archived, setArchived] = useState(false);

  const rate = (next: string) => {
    if (next === current) return;
    setCurrent(next); // optimistisch: ein Tipp soll sofort sichtbar sein
    startTransition(async () => {
      await setRecipeRatingAction(id, next);
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const { deleted } = await deleteRecipeAction(id);
      if (deleted) {
        router.push(RECIPES_PATH);
      } else {
        // Noch verplant: das Rezept wurde nur archiviert und ist damit aus der
        // Liste raus — die Wochenhistorie soll aber lesbar bleiben.
        setArchived(true);
        setConfirming(false);
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {RATINGS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => rate(value)}
            aria-pressed={current === value}
            className={`${PILL} ${current === value ? ON : OFF}`}
          >
            {value === "favorit" && (
              <Star size={11} strokeWidth={2.2} className={current === value ? "fill-current" : ""} />
            )}
            {RATING_LABEL[value]}
          </button>
        ))}

        <button
          type="button"
          onClick={remove}
          className={`${PILL} ml-auto ${
            confirming
              ? "bg-rose-500 text-white"
              : "bg-cream/70 dark:bg-white/[0.06] text-ink-faint hover:text-rose-500"
          }`}
        >
          <Trash2 size={11} strokeWidth={2.2} />
          {confirming ? "Wirklich löschen?" : "Löschen"}
        </button>
      </div>

      {archived && (
        <p className="text-[12px] text-amber-700 dark:text-amber-300">
          Das Rezept steht noch in einem Essensplan und wurde deshalb nur archiviert — es
          verschwindet aus der Liste, die Wochenhistorie bleibt heil.
        </p>
      )}
    </div>
  );
}
