"use client";

// Gericht-Auswahl für den Essensplan (aktive Woche und Entwurf). Ersetzt das
// frühere <select>: ein Fenster von unten mit Suchfeld, Tag-Chips und der
// ganzen Liste. Ohne Eingabe bleibt die Liste vollständig; die Suche trifft
// Name, Zutaten und Tags ("zucchini" → alles mit Zucchini).
//
// Gefiltert wird im Browser mit derselben Logik wie die Rezepte-Seite
// (`recipeSearch.ts`) — bei Haushaltsgröße reicht das.

import { useMemo, useRef, useState } from "react";

import type { Recipe } from "@/lib/domain";
import { applyFilters, collectTags, visibleTags } from "@/lib/services/recipeSearch";

const CHIP = "inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-colors";
const CHIP_OFF = "bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70";
const CHIP_ON = "bg-dome-deep dark:bg-dome text-white dark:text-[#26241F]";

export function RecipePicker({
  recipes,
  currentId,
  title,
  disabled,
  onPick,
  triggerClassName,
}: {
  recipes: Recipe[];
  currentId: string | null;
  title: string;
  disabled?: boolean;
  /** Rezept-id, oder "" für "überspringen". */
  onPick: (recipeId: string) => void;
  triggerClassName?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const allTags = useMemo(() => collectTags(recipes), [recipes]);
  const shown = useMemo(() => applyFilters(recipes, { query, tags }), [recipes, query, tags]);
  const filtering = query.trim() !== "" || tags.length > 0;

  const open = () => {
    setQuery("");
    setTags([]);
    dialog.current?.showModal();
  };
  const pick = (id: string) => {
    dialog.current?.close();
    if (id !== (currentId ?? "")) onPick(id);
  };
  const toggleTag = (tag: string) =>
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  const row = (id: string, label: string) => (
    <li key={id || "skip"}>
      <button
        type="button"
        onClick={() => pick(id)}
        className={`w-full text-left px-3 py-2.5 rounded-xl text-[14px] hover:bg-cream/70 dark:hover:bg-white/[0.06] ${
          id === (currentId ?? "") ? "font-semibold text-ink dark:text-cream" : "text-ink-soft dark:text-cream/75"
        }`}
      >
        {label}
        {id === (currentId ?? "") && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">✓</span>}
      </button>
    </li>
  );

  return (
    <>
      <button type="button" onClick={open} disabled={disabled} className={triggerClassName} aria-label={title}>
        tauschen ▾
      </button>

      <dialog
        ref={dialog}
        // Klick auf den abgedunkelten Hintergrund (= das dialog-Element selbst) schließt.
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="open:flex flex-col w-full max-w-md max-h-[85dvh] mx-auto mt-auto mb-0 p-0 rounded-t-3xl
                   bg-white dark:bg-[#26241F] text-ink dark:text-cream backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <h2 className="font-display font-semibold text-[16px]">{title}</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="text-ink-faint text-[18px] px-2 leading-none"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="px-4 space-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gericht oder Zutat…"
            className="w-full text-[14px] rounded-xl bg-cream/60 dark:bg-white/[0.06] px-3 py-2 outline-none
                       focus:ring-2 focus:ring-dome/40"
          />
          {allTags.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {visibleTags(allTags, tags).map(({ tag, count }) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={active}
                    className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
                  >
                    {tag}
                    <span className={active ? "opacity-70" : "text-ink-faint"}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <ul className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
          {!filtering && row("", "— überspringen")}
          {shown.map((r) => row(r.id, r.name))}
          {shown.length === 0 && <li className="px-3 py-4 text-[13px] text-ink-faint">Nichts gefunden.</li>}
        </ul>
      </dialog>
    </>
  );
}
