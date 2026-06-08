"use client";

// Manual "send to Bring!" trigger for the shopping list (Phase 7). Bring has no
// official API — the dashboard pushes on request rather than silently in the
// background, and falls back to a copy-to-clipboard list when the push fails
// (see docs/spikes/2026-06-07-bring-machbarkeit.md: "Push mit Fallback").

import { useState, useTransition } from "react";

import type { ShoppingItem } from "@/lib/data";
import { pushToBringAction } from "@/app/actions/shopping";
import type { BringPushResult } from "@/integrations/bring/client";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function BringSyncControl({ items }: { items: ShoppingItem[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BringPushResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePush = () => {
    setCopied(false);
    startTransition(async () => {
      setResult(await pushToBringAction());
    });
  };

  const handleCopy = () => {
    const text = items
      .filter((item) => !item.done)
      .map((item) => `• ${item.text}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  };

  let label = "An Bring senden";
  let tone = "text-ink-soft bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07]";
  if (pending) {
    label = "Sende …";
  } else if (result?.ok) {
    label = result.pushed > 0 ? `✓ ${result.pushed} an Bring gesendet` : "✓ Bring ist aktuell";
    tone = "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300";
  } else if (result && !result.ok) {
    label = "Bring nicht erreichbar";
    tone = "text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300";
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" onClick={handlePush} disabled={pending} className={`${PILL} ${tone} disabled:cursor-wait`}>
        {label}
      </button>
      {result && !result.ok && (
        <div className="text-right max-w-[200px]">
          <button
            type="button"
            onClick={handleCopy}
            className="text-[11px] font-semibold text-ink-faint hover:text-ink-soft dark:hover:text-cream/70 underline decoration-dotted underline-offset-2"
          >
            {copied ? "In Zwischenablage kopiert ✓" : "Liste zum Einfügen kopieren"}
          </button>
        </div>
      )}
    </div>
  );
}
