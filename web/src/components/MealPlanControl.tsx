"use client";

// "Woche neu planen" trigger for the meal plan (Phase 6 + 7). One click:
// generates a fresh (shuffled) week plan, syncs the recipe ingredients onto the
// shopping list, and pushes exactly those ingredients to Bring!. Shows the
// outcome inline and — if the Bring push fails — offers the same manual
// copy-to-clipboard fallback as the shopping list (see BringSyncControl /
// docs/spikes/2026-06-07-bring-machbarkeit.md).

import { useState, useTransition } from "react";

import { generatePlanAction, type GeneratePlanResult } from "@/app/actions/meals";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function MealPlanControl() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GeneratePlanResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    setCopied(false);
    setResult(null);
    startTransition(async () => {
      setResult(await generatePlanAction(new Date()));
    });
  };

  const handleCopy = () => {
    if (!result) return;
    const text = result.ingredients.map((name) => `• ${name}`).join("\n");
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  };

  const bringFailed = result != null && !result.bring.ok;

  let label = "Woche neu planen";
  let tone = "text-ink-soft bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07]";
  if (pending) {
    label = "Plane …";
  } else if (result?.bring.ok) {
    label = `✓ Plan + ${result.bring.pushed} an Bring`;
    tone = "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300";
  } else if (bringFailed) {
    label = "Plan aktualisiert · Bring fehlte";
    tone = "text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300";
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" onClick={handleGenerate} disabled={pending} className={`${PILL} ${tone} disabled:cursor-wait`}>
        {label}
      </button>
      {bringFailed && (
        <button
          type="button"
          onClick={handleCopy}
          className="text-[11px] font-semibold text-ink-faint hover:text-ink-soft dark:hover:text-cream/70 underline decoration-dotted underline-offset-2"
        >
          {copied ? "Zutaten kopiert ✓" : "Zutaten zum Einfügen kopieren"}
        </button>
      )}
    </div>
  );
}
