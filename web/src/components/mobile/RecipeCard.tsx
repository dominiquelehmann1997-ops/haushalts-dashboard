// Eine Zeile der Rezeptliste. Server-Komponente — sie ist reine Anzeige.

import Link from "next/link";
import { Clock, Flame, Star } from "lucide-react";

import type { Recipe } from "@/lib/domain";

const CHIP =
  "inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full " +
  "bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70";

/** Kurzform der Gesamtzeit: "40 min" bzw. "1 h 20". */
export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      href={`/mobile/meals/rezepte/${recipe.id}`}
      className="flex gap-3 items-center rounded-2xl bg-white/60 dark:bg-white/[0.04] p-2.5 shadow-card
                 hover:bg-white dark:hover:bg-white/[0.07] transition-colors"
    >
      {recipe.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- lokale Datei, kein Optimierer nötig
        <img
          src={recipe.imageUrl}
          alt=""
          className="w-16 h-16 rounded-xl object-cover shrink-0 bg-cream dark:bg-white/[0.06]"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl shrink-0 bg-cream dark:bg-white/[0.06] grid place-items-center text-[22px]">
          🍽️
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {recipe.rating === "favorit" && (
            <Star size={13} className="shrink-0 text-amber-500 fill-amber-500" aria-label="Favorit" />
          )}
          <span className="font-semibold text-[14px] text-ink dark:text-cream truncate">
            {recipe.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {recipe.totalMinutes !== null && (
            <span className={CHIP}>
              <Clock size={11} strokeWidth={2.2} />
              {formatMinutes(recipe.totalMinutes)}
            </span>
          )}
          {recipe.kcal !== null && (
            <span className={CHIP}>
              <Flame size={11} strokeWidth={2.2} />
              {recipe.kcal} kcal
            </span>
          )}
          {recipe.tags.slice(0, 2).map((tag) => (
            <span key={tag} className={CHIP}>
              {tag}
            </span>
          ))}
          {recipe.tags.length > 2 && (
            <span className="text-[10.5px] text-ink-faint">+{recipe.tags.length - 2}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
