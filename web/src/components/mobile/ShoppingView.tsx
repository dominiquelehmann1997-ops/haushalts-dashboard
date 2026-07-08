"use client";

import { useOptimistic, startTransition } from "react";
import type { ShoppingItem } from "@/lib/data";
import { toggleShoppingAction, deleteShoppingAction, clearShoppingAction } from "@/app/actions/shopping";
import { BringSyncControl } from "@/components/BringSyncControl";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";

type Action =
  | { kind: "toggle"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "clear" };

function reduce(state: ShoppingItem[], action: Action): ShoppingItem[] {
  switch (action.kind) {
    case "toggle":
      return state.map((i) => (i.id === action.id ? { ...i, done: !i.done } : i));
    case "delete":
      return state.filter((i) => i.id !== action.id);
    case "clear":
      return [];
  }
}

export function ShoppingView({ items }: { items: ShoppingItem[] }) {
  const [list, dispatch] = useOptimistic(items, reduce);
  // Anzeige-Sortierung: offene vor erledigten. Array.sort ist stabil → gleiche
  // Schlüssel behalten die Eingangsreihenfolge.
  const sorted = [...list].sort((a, b) => Number(a.done) - Number(b.done));

  const toggle = (id: string) =>
    startTransition(async () => {
      dispatch({ kind: "toggle", id });
      await toggleShoppingAction(id);
    });

  const remove = (id: string) =>
    startTransition(async () => {
      dispatch({ kind: "delete", id });
      await deleteShoppingAction(id);
    });

  const clearAll = () => {
    if (!window.confirm("Ganze Einkaufsliste löschen?")) return;
    startTransition(async () => {
      dispatch({ kind: "clear" });
      await clearShoppingAction();
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Steuerung" title="Einkauf" right={<BringSyncControl items={list} />} />

      <Card>
        <ul className="-my-0.5">
          {sorted.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => toggle(i.id)}
                aria-label={i.done ? "Wieder offen" : "Erledigt"}
                className={`shrink-0 w-6 h-6 rounded-full grid place-items-center border-2 transition-all ${
                  i.done ? "bg-dome border-transparent text-white" : "border-ink-faint/40 text-transparent"
                }`}
              >
                ✓
              </button>
              <span
                className={`flex-1 min-w-0 text-[15px] ${
                  i.done ? "line-through text-ink-faint" : "text-ink dark:text-cream/90"
                }`}
              >
                {i.meal && <span className="mr-1.5">🍽️</span>}
                {i.text}
              </span>
              <button
                type="button"
                onClick={() => remove(i.id)}
                aria-label={`${i.text} löschen`}
                className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-ink-faint hover:text-red-500 active:scale-90 transition-all"
              >
                🗑️
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="py-6 text-center text-ink-faint text-[14px]">Liste ist leer.</li>}
        </ul>
      </Card>

      {list.length > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="w-full py-3 rounded-2xl text-[14px] font-semibold text-red-500 bg-red-500/5 active:bg-red-500/10 transition-colors"
        >
          Liste leeren
        </button>
      )}
    </div>
  );
}
