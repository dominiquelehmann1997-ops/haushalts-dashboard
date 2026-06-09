"use client";

// Entwurfs-Ansicht des Wochenplans (Roadmap C1): zeigt den Pending-Entwurf
// separat von der (aktiven) Essensplan-Kachel. Pro Tag: Gericht + dienstbewusstes
// Badge, "neu würfeln" und "tauschen". Abnicken befördert den Entwurf zum
// aktiven Plan und pusht die Zutaten auf Bring (mit manuellem Kopier-Fallback).

import { useState, useTransition } from "react";

import type { DraftMeal, RecipeOption } from "@/lib/data";
import { MealReasonBadge } from "@/components/widgets";
import {
  approveDraftAction,
  discardDraftAction,
  rerollDraftDayAction,
  setDraftDayRecipeAction,
  type ApprovePlanResult,
} from "@/app/actions/meals";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function MealDraftPanel({ draft, recipes }: { draft: DraftMeal[]; recipes: RecipeOption[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ApprovePlanResult | null>(null);
  const [copied, setCopied] = useState(false);

  const run = (fn: () => Promise<void>) => {
    setResult(null);
    setCopied(false);
    startTransition(fn);
  };

  const handleApprove = () => {
    setResult(null);
    setCopied(false);
    startTransition(async () => {
      setResult(await approveDraftAction(new Date().toISOString()));
    });
  };

  const handleCopy = () => {
    if (!result) return;
    const text = result.ingredients.map((name) => `• ${name}`).join("\n");
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  };

  const bringFailed = result?.approved === true && !result.bring.ok;

  return (
    <div className="rounded-3xl bg-white/80 dark:bg-white/[0.04] ring-1 ring-amber-300/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Entwurf · Woche
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => run(() => discardDraftAction(new Date().toISOString()))}
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
            {pending ? "…" : result?.bring.ok ? `✓ Abgenickt · ${result.bring.pushed} an Bring` : "Abnicken"}
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
            <select
              key={m.recipeId}
              defaultValue={m.recipeId}
              disabled={pending}
              onChange={(e) => run(() => setDraftDayRecipeAction(m.dateISO, e.target.value))}
              className="shrink-0 text-[12px] rounded-lg bg-white dark:bg-white/10 px-1.5 py-1 max-w-[120px]"
              aria-label={`${m.day} Gericht tauschen`}
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      {bringFailed && (
        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 text-[11px] font-semibold text-ink-faint hover:text-ink-soft underline decoration-dotted underline-offset-2"
        >
          {copied ? "Zutaten kopiert ✓" : "Bring fehlte — Zutaten zum Einfügen kopieren"}
        </button>
      )}
    </div>
  );
}
