"use client";

// Entwurfs-Ansicht des Wochenplans (Roadmap C1): zeigt den Pending-Entwurf
// separat von der (aktiven) Essensplan-Kachel. Pro Tag: Gericht + dienstbewusstes
// Badge, "neu würfeln" und "tauschen". Abnicken befördert den Entwurf nur zum
// aktiven Plan — Bring wird bewusst NICHT berührt; das passiert erst später,
// pro Gericht, aus der aktiven Wochenübersicht.
//
// `weekStartISO`/`weekLabel` binden das Panel an eine bestimmte Woche — ohne
// Angabe die laufende. So lässt sich ein Entwurf für eine kommende Woche
// abnicken oder verwerfen, bevor sie beginnt.

import { useState, useTransition } from "react";

import type { DraftMeal, Recipe } from "@/lib/data";
import { MealReasonBadge } from "@/components/widgets";
import { RecipePicker } from "@/components/mobile/RecipePicker";
import {
  approveDraftAction,
  discardDraftAction,
  rerollDraftDayAction,
  setDraftDayRecipeAction,
} from "@/app/actions/meals";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function MealDraftPanel({
  draft,
  recipes,
  weekStartISO,
  weekLabel,
}: {
  draft: DraftMeal[];
  recipes: Recipe[];
  weekStartISO?: string;
  weekLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [approved, setApproved] = useState(false);

  const weekISO = () => weekStartISO ?? new Date().toISOString();

  const run = (fn: () => Promise<void>) => {
    startTransition(fn);
  };

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveDraftAction(weekISO());
      setApproved(result.approved);
    });
  };

  return (
    <div className="rounded-3xl bg-white/80 dark:bg-white/[0.04] ring-1 ring-amber-300/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Entwurf · {weekLabel ?? "Woche"}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => run(() => discardDraftAction(weekISO()))}
            disabled={pending}
            className={`${PILL} text-ink-faint bg-cream/60 dark:bg-white/[0.04] hover:bg-cream disabled:cursor-wait`}
          >
            Verwerfen
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending}
            className={`${PILL} text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300 hover:bg-emerald-100 disabled:cursor-wait`}
          >
            {pending ? "…" : approved ? "✓ Abgenickt" : "Abnicken"}
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {draft.map((m) => (
          <li key={m.dateISO} className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-cream/60 dark:bg-white/[0.03]">
            <span className="shrink-0 w-9 h-9 rounded-full grid place-items-center font-display font-semibold text-[13px] bg-white dark:bg-white/10 text-ink-soft dark:text-cream/60">
              {m.day}
            </span>
            <span className="flex-1 min-w-0 text-[14.5px] text-ink-soft dark:text-cream/70">{m.dish}</span>
            <MealReasonBadge reason={m.reason} extraPortion={m.extraPortion} />
            <button
              type="button"
              onClick={() => run(() => rerollDraftDayAction(m.dateISO))}
              disabled={pending}
              title={`${m.day} neu würfeln`}
              className="shrink-0 text-[13px] px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-white/10 disabled:cursor-wait"
            >
              🎲
            </button>
            <RecipePicker
              recipes={recipes}
              currentId={m.recipeId ?? null}
              title={`Gericht für ${m.day} wählen`}
              disabled={pending}
              onPick={(id) => run(() => setDraftDayRecipeAction(m.dateISO, id))}
              triggerClassName="shrink-0 text-[12px] rounded-lg bg-white dark:bg-white/10 px-2 py-1 disabled:cursor-wait"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
