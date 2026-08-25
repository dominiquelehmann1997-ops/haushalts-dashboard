import Link from "next/link";
import { notFound } from "next/navigation";
import { ChefHat, Clock, Drumstick, Flame, Link2, Pencil, Users } from "lucide-react";

import { PageHeader } from "@/components/mobile/PageHeader";
import { formatMinutes } from "@/components/mobile/RecipeCard";
import { RecipeDetailActions } from "@/components/mobile/RecipeDetailActions";
import { RecipePortionList } from "@/components/mobile/RecipePortionList";
import { getRecipe } from "@/lib/repositories/recipes";
import { RECIPES_PATH } from "@/lib/recipeFilterParams";

export const dynamic = "force-dynamic";

const CHIP =
  "inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full " +
  "bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70";

export default async function MobileRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  return (
    <div className="space-y-4">
      {/* Aktionen bewusst UNTER dem Titel statt im `right`-Slot: dort ist der
          Block shrink-0, und ein Rezeptname wie "Asia-Udon-Salat mit Mango,
          Edamame & Chilioel-Joghurt" wurde dadurch auf ein bis zwei Woerter
          pro Zeile zusammengequetscht -- elf Zeilen Ueberschrift. Der Titel
          bekommt jetzt die volle Breite, die Knoepfe umbrechen selbst. */}
      <PageHeader eyebrow="Rezept" title={recipe.name} />

      <div className="flex flex-wrap items-center gap-1.5 -mt-2">
        {(recipe.ingredients.length > 0 || recipe.steps.length > 0) && (
          <Link
            href={`${RECIPES_PATH}/${recipe.id}/kochen`}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                       bg-dome-deep/10 dark:bg-dome/15 text-dome-deep dark:text-dome
                       hover:bg-dome-deep/15 dark:hover:bg-dome/25 transition-colors"
          >
            <ChefHat size={11} strokeWidth={2.2} />
            Kochen
          </Link>
        )}
        <Link
          href={`${RECIPES_PATH}/${recipe.id}/bearbeiten`}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                     bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70
                     hover:bg-cream dark:hover:bg-white/[0.1] transition-colors"
        >
          <Pencil size={11} strokeWidth={2.2} />
          Bearbeiten
        </Link>
        <Link
          href={RECIPES_PATH}
          className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                     bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70
                     hover:bg-cream dark:hover:bg-white/[0.1] transition-colors"
        >
          Rezepte
        </Link>
      </div>

      {recipe.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- lokale Datei, kein Optimierer nötig
        <img
          src={recipe.imageUrl}
          alt=""
          className="w-full max-h-56 rounded-2xl object-cover bg-cream dark:bg-white/[0.06]"
        />
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {recipe.totalMinutes !== null && (
          <span className={CHIP}>
            <Clock size={11} strokeWidth={2.2} />
            {formatMinutes(recipe.totalMinutes)}
          </span>
        )}
        {recipe.servings !== null && (
          <span className={CHIP}>
            <Users size={11} strokeWidth={2.2} />
            {recipe.servings} Portionen
          </span>
        )}
        {recipe.kcal !== null && (
          <span className={CHIP}>
            <Flame size={11} strokeWidth={2.2} />
            {recipe.kcal} kcal/Portion
          </span>
        )}
        {recipe.protein !== null && (
          <span className={CHIP}>
            <Drumstick size={11} strokeWidth={2.2} />
            {recipe.protein} g Eiweiß
          </span>
        )}
        {recipe.simple && <span className={CHIP}>einfach</span>}
        {recipe.reheatable && <span className={CHIP}>aufwärmbar</span>}
        {recipe.tags.map((tag) => (
          <span key={tag} className={CHIP}>
            {tag}
          </span>
        ))}
      </div>

      {(recipe.prepMinutes !== null || recipe.cookMinutes !== null) && (
        <p className="text-[12px] text-ink-faint">
          {[
            recipe.prepMinutes !== null ? `${recipe.prepMinutes} min Vorbereitung` : null,
            recipe.cookMinutes !== null ? `${recipe.cookMinutes} min Kochzeit` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <RecipeDetailActions id={recipe.id} rating={recipe.rating} />

      <RecipePortionList ingredients={recipe.ingredients} servings={recipe.servings} />

      {recipe.steps.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
            Zubereitung
          </h2>
          <ol className="space-y-2">
            {recipe.steps.map((step, index) => (
              <li key={index} className="flex gap-2.5">
                <span
                  className="shrink-0 w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold
                             bg-cream dark:bg-white/[0.08] text-ink-soft dark:text-cream/70"
                >
                  {index + 1}
                </span>
                <span className="text-[13.5px] leading-relaxed text-ink dark:text-cream/85">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.notes && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
            Notizen
          </h2>
          <p className="text-[13.5px] leading-relaxed text-ink dark:text-cream/85 whitespace-pre-line">
            {recipe.notes}
          </p>
        </section>
      )}

      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft dark:text-cream/60
                     underline decoration-dotted underline-offset-2 break-all"
        >
          <Link2 size={12} strokeWidth={2.2} className="shrink-0" />
          {recipe.sourceUrl}
        </a>
      )}
    </div>
  );
}
