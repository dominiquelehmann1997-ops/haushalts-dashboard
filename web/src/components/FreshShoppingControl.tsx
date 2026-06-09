"use client";

// Frische-Einkauf (Roadmap D1): zeigt die noch offene Frisch-Rutsche mit einem
// Vorschlagstag und einem Knopf, der sie auf Bring pusht (gestaffelter zweiter
// Einkauf nah am Verbrauch). Nur sichtbar, wenn offene Frisch-Items existieren.

import { useState, useTransition } from "react";

import type { FreshShoppingState } from "@/lib/data";
import { pushFreshBatchAction } from "@/app/actions/meals";
import type { BringPushResult } from "@/integrations/bring/client";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

export function FreshShoppingControl({ fresh }: { fresh: FreshShoppingState }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ bring: BringPushResult; items: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  if (fresh.pendingItems.length === 0) return null;

  const dayLabel = fresh.suggestedDayISO ? WEEKDAYS[new Date(fresh.suggestedDayISO).getDay()] : null;

  const handlePush = () => {
    setCopied(false);
    startTransition(async () => {
      setResult(await pushFreshBatchAction());
    });
  };

  const handleCopy = () => {
    const text = fresh.pendingItems.map((name) => `• ${name}`).join("\n");
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  };

  const bringFailed = result != null && !result.bring.ok;

  return (
    <div className="rounded-3xl bg-white/80 dark:bg-white/[0.04] ring-1 ring-sky-300/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Frische-Einkauf{dayLabel ? ` · Vorschlag ${dayLabel}` : ""}
        </div>
        <button
          type="button"
          onClick={handlePush}
          disabled={pending}
          className={`${PILL} text-sky-700 bg-sky-50 dark:bg-sky-500/15 dark:text-sky-300 hover:bg-sky-100 disabled:cursor-wait`}
        >
          {pending ? "…" : result?.bring.ok ? `✓ ${result.bring.pushed} an Bring` : "Jetzt auf Bring"}
        </button>
      </div>
      <p className="text-[13px] text-ink-soft dark:text-cream/70">{fresh.pendingItems.join(" · ")}</p>
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
