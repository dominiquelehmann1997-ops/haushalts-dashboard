"use client";

// Manueller Trigger: liest den Rezepte-Vault ein und spiegelt ihn in die DB.
// Zeigt nach dem Lauf einen kurzen Report (importiert/archiviert/Fehler).

import { useState, useTransition } from "react";

import { ingestVaultAction } from "@/app/actions/recipes";
import type { IngestReport } from "@/lib/repositories/recipeIngest";

const PILL =
  "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function VaultIngestControl() {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<IngestReport | null>(null);

  const handleIngest = () => {
    startTransition(async () => {
      setReport(await ingestVaultAction());
    });
  };

  let label = "Rezepte einlesen";
  let tone = "text-ink-soft bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07]";
  if (pending) {
    label = "Lese …";
  } else if (report && report.errors.length === 0) {
    label = `✓ ${report.imported} eingelesen${report.archived > 0 ? `, ${report.archived} archiviert` : ""}`;
    tone = "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300";
  } else if (report && report.errors.length > 0) {
    label = `⚠ ${report.imported} ok, ${report.errors.length} Fehler`;
    tone = "text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300";
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleIngest}
        disabled={pending}
        className={`${PILL} ${tone} disabled:cursor-wait`}
      >
        {label}
      </button>
      {report && report.errors.length > 0 && (
        <ul className="text-right max-w-[260px] text-[11px] text-ink-faint dark:text-cream/50 space-y-0.5">
          {report.errors.slice(0, 3).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
