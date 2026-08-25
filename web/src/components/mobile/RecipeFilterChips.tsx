// Filter-Chips der Rezeptliste. Bewusst Server-Komponente: jeder Chip ist ein
// <Link> auf dieselbe Seite mit geändertem Filter. Das braucht kein JavaScript,
// erhält den Zurück-Button und lässt sich als Lesezeichen ablegen.

import Link from "next/link";

import type { RecipeFilter, RecipeTagCount } from "@/lib/domain";
import { recipesHref, toggleField, toggleTag } from "@/lib/recipeFilterParams";

const BASE =
  "inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full transition-colors whitespace-nowrap";
const OFF =
  "bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70 hover:bg-cream dark:hover:bg-white/[0.1]";
const ON = "bg-dome-deep dark:bg-dome text-white dark:text-[#26241F]";

/** kcal-Schwellen, die im Alltag etwas bedeuten (≤500 = "kalorienarm"). */
const KCAL_STEPS = [400, 500, 600];
/** Zeitschwellen: Feierabend-schnell, normal, "hab Zeit". */
const MINUTE_STEPS = [20, 30, 45];

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${active ? ON : OFF}`} aria-pressed={active}>
      {children}
    </Link>
  );
}

export function RecipeFilterChips({
  filter,
  tags,
}: {
  filter: RecipeFilter;
  tags: RecipeTagCount[];
}) {
  const activeTags = filter.tags ?? [];

  // Sonst wird die Chip-Leiste bei vielen Tags unbedienbar. Aktive Tags sind
  // immer dabei, auch wenn sie sonst hinten rausfielen.
  const shown = [
    ...tags.filter((t) => activeTags.includes(t.tag)),
    ...tags.filter((t) => !activeTags.includes(t.tag)).slice(0, 12),
  ];

  return (
    <div className="space-y-2">
      {shown.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {shown.map(({ tag, count }) => {
            const active = activeTags.includes(tag);
            return (
              <Chip key={tag} href={recipesHref(toggleTag(filter, tag))} active={active}>
                {tag}
                <span className={active ? "opacity-70" : "text-ink-faint"}>{count}</span>
              </Chip>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <Chip
          href={recipesHref(toggleField(filter, "rating", "favorit"))}
          active={filter.rating === "favorit"}
        >
          ★ Favoriten
        </Chip>
        <Chip
          href={recipesHref(toggleField(filter, "simpleOnly", true))}
          active={filter.simpleOnly === true}
        >
          einfach
        </Chip>
        <Chip
          href={recipesHref(toggleField(filter, "reheatableOnly", true))}
          active={filter.reheatableOnly === true}
        >
          aufwärmbar
        </Chip>

        {KCAL_STEPS.map((kcal) => (
          <Chip
            key={kcal}
            href={recipesHref(toggleField(filter, "maxKcal", kcal))}
            active={filter.maxKcal === kcal}
          >
            ≤ {kcal} kcal
          </Chip>
        ))}

        {MINUTE_STEPS.map((min) => (
          <Chip
            key={min}
            href={recipesHref(toggleField(filter, "maxMinutes", min))}
            active={filter.maxMinutes === min}
          >
            ≤ {min} min
          </Chip>
        ))}
      </div>
    </div>
  );
}
