"use client";

// Suchfeld der Rezeptliste. Schreibt in die URL statt in lokalen State, damit
// der Zurück-Button und Lesezeichen funktionieren; getippt wird entprellt,
// sonst würde jeder Tastendruck eine Server-Navigation auslösen.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import type { RecipeFilter } from "@/lib/domain";
import { recipesHref, withQuery } from "@/lib/recipeFilterParams";

const DEBOUNCE_MS = 250;

export function RecipeSearchBar({ filter }: { filter: RecipeFilter }) {
  const router = useRouter();
  const serverQuery = filter.query ?? "";

  const [value, setValue] = useState(serverQuery);

  // Der Filter kommt vom Server. Ändert er sich anderswo (Chip geklickt,
  // Zurück-Button, Filter zurückgesetzt), muss das Feld nachziehen. Das ist
  // React's "State bei Prop-Wechsel anpassen" — bewusst kein Effekt, der
  // würde einen zweiten Render-Durchlauf auslösen.
  const [lastServerQuery, setLastServerQuery] = useState(serverQuery);
  if (serverQuery !== lastServerQuery) {
    setLastServerQuery(serverQuery);
    setValue(serverQuery);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const navigate = (next: string) => {
    if (next.trim() === serverQuery) return;
    router.replace(recipesHref(withQuery(filter, next)));
  };

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setValue("");
    navigate("");
  };

  return (
    <div className="relative">
      <Search
        size={16}
        strokeWidth={2}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
      />
      <input
        type="search"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (timer.current) clearTimeout(timer.current);
            navigate(value);
          }
        }}
        placeholder="Rezept, Zutat oder Tag …"
        aria-label="Rezepte durchsuchen"
        className="w-full rounded-xl border border-ink/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.04]
                   pl-9 pr-9 py-2 text-[13.5px] text-ink dark:text-cream/90
                   placeholder:text-ink-faint dark:placeholder:text-cream/40
                   outline-none focus:border-ink/25 dark:focus:border-white/25
                   [&::-webkit-search-cancel-button]:hidden"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={clear}
          aria-label="Suche zurücksetzen"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center
                     rounded-full text-ink-faint hover:text-ink-soft dark:hover:text-cream/70"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
