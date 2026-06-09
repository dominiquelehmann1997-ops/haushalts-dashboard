"use client";

// "Woche neu planen" — erzeugt einen dienstbewussten ENTWURF des Wochenplans
// (Roadmap C1). Der Entwurf erscheint danach im MealDraftPanel zum Abnicken
// oder Ändern; Zutaten/Bring passieren erst beim Abnicken (dort).

import { useState, useTransition } from "react";

import { generatePlanAction } from "@/app/actions/meals";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function MealPlanControl() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const handleGenerate = () => {
    setDone(false);
    startTransition(async () => {
      await generatePlanAction(new Date());
      setDone(true);
    });
  };

  let label = "Woche neu planen";
  let tone = "text-ink-soft bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07]";
  if (pending) {
    label = "Plane …";
  } else if (done) {
    label = "✓ Entwurf erstellt";
    tone = "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300";
  }

  return (
    <button type="button" onClick={handleGenerate} disabled={pending} className={`${PILL} ${tone} disabled:cursor-wait`}>
      {label}
    </button>
  );
}
