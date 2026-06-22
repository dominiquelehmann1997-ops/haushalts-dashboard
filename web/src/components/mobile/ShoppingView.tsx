"use client";

import { useOptimistic, startTransition } from "react";
import type { ShoppingItem, FreshShoppingState } from "@/lib/data";
import {
  toggleShoppingAction,
  toggleFreshnessAction,
  deleteShoppingAction,
  clearShoppingAction,
} from "@/app/actions/shopping";
import { BringSyncControl } from "@/components/BringSyncControl";
import { FreshShoppingControl } from "@/components/FreshShoppingControl";
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

export function ShoppingView({ items, fresh }: { items: ShoppingItem[]; fresh: FreshShoppingState }) {
  const [list, dispatch] = useOptimistic(items, reduce);

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

  const flipFresh = (id: string) =>
    startTransition(async () => {
      await toggleFreshnessAction(id);
    });

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Steuerung" title="Einkauf" right={<BringSyncControl items={list} />} />

      <FreshShoppingControl fresh={fresh} />

      <Card>
        <ul className="-my-0.5">
          {list.map((i) => (
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
              {i.category && (
                <button
                  type="button"
                  onClick={() => flipFresh(i.id)}
                  className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cream/70 dark:bg-white/[0.05] text-ink-soft"
                >
                  {i.category === "frisch" ? "frisch" : "haltbar"}
                </button>
              )}
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
