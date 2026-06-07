"use client";

// Small, calm control to switch between Normal/Elternzeit and adjust the
// target split. Lives behind a quiet "anpassen" affordance inside the
// ElternzeitStripe so the stripe stays glanceable by default.

import { useState, useTransition } from "react";

import type { ActivePhase } from "@/lib/repositories/phase";
import { setPhaseAction } from "@/app/actions/phase";

const PRESETS: { dome: number; emely: number; label: string }[] = [
  { dome: 50, emely: 50, label: "50/50" },
  { dome: 60, emely: 40, label: "60/40" },
  { dome: 70, emely: 30, label: "70/30" },
];

export function PhaseSwitch({ phase }: { phase: ActivePhase | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const mode = phase?.mode === "normal" ? "normal" : "elternzeit";
  const targetDome = phase?.targetDome ?? 50;
  const targetEmely = phase?.targetEmely ?? 50;

  const apply = (next: { mode: "normal" | "elternzeit"; targetDome: number; targetEmely: number }) => {
    startTransition(() => {
      setPhaseAction({
        ...next,
        caregiverKey: next.mode === "elternzeit" ? "emely" : null,
      });
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Phase und Zielaufteilung anpassen"
        className="shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-faint hover:text-ink-soft dark:hover:text-cream/60 px-2.5 py-1 rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
      >
        <span aria-hidden className="text-[12px]">
          ⚙
        </span>
        anpassen
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-white/70 dark:bg-white/[0.04] ring-1 ring-black/[0.05] dark:ring-white/5 px-3.5 py-3 text-[12.5px]">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <span className="font-semibold text-ink dark:text-cream/85">Phase & Zielaufteilung</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Schließen"
          className="text-ink-faint hover:text-ink-soft dark:hover:text-cream/70 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        {(["elternzeit", "normal"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              disabled={pending}
              onClick={() =>
                apply({
                  mode: m,
                  targetDome: m === "elternzeit" ? 60 : targetDome,
                  targetEmely: m === "elternzeit" ? 40 : targetEmely,
                })
              }
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors disabled:opacity-50 ${
                active
                  ? "bg-ink text-cream dark:bg-cream dark:text-ink"
                  : "text-ink-soft bg-cream/70 dark:bg-white/[0.04] dark:text-cream/55 hover:text-ink"
              }`}
            >
              {m === "elternzeit" ? "Elternzeit" : "Normal"}
            </button>
          );
        })}
      </div>

      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-1.5">
        Ziel-Aufteilung
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => {
          const active = targetDome === preset.dome && targetEmely === preset.emely;
          return (
            <button
              key={preset.label}
              type="button"
              disabled={pending}
              onClick={() => apply({ mode, targetDome: preset.dome, targetEmely: preset.emely })}
              className={`px-2.5 py-1 rounded-full font-semibold tabular-nums transition-colors disabled:opacity-50 ${
                active
                  ? "bg-dome-soft text-dome-deep dark:bg-dome/20 dark:text-dome"
                  : "text-ink-soft bg-cream/70 dark:bg-white/[0.04] dark:text-cream/55 hover:text-ink"
              }`}
            >
              Dome {preset.dome} / Emely {preset.emely}
            </button>
          );
        })}
      </div>
    </div>
  );
}
