"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addManualEntryAction } from "@/app/actions/accounts";

/** Kompaktes "Erledigt nachtragen" für eine feste Person (Kachel-Header "+"). */
export function AddDoneInline({ person }: { person: "dome" | "emely" }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    const parsed = Number(points);
    if (!trimmed || !Number.isFinite(parsed) || parsed <= 0) return;
    startTransition(async () => {
      await addManualEntryAction({
        personKey: person,
        label: trimmed,
        points: Math.round(parsed),
        source: "nachtrag",
      });
      setLabel("");
      setPoints("");
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Erledigt nachtragen"
        className="shrink-0 w-7 h-7 grid place-items-center rounded-full text-ink-soft dark:text-cream/55 bg-cream/70 dark:bg-white/[0.05] hover:bg-cream dark:hover:bg-white/10 text-[15px] leading-none transition-colors"
      >
        +
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Erledigt …"
        autoFocus
        className="w-28 text-[12.5px] bg-cream/60 dark:bg-white/[0.05] rounded-lg px-2 py-1 outline-none text-ink dark:text-cream/90 placeholder:text-ink-faint"
      />
      <input
        type="number"
        min={1}
        inputMode="numeric"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        placeholder="Min"
        className="w-12 text-[12.5px] bg-cream/60 dark:bg-white/[0.05] rounded-lg px-2 py-1 outline-none tabular-nums text-ink dark:text-cream/90 placeholder:text-ink-faint"
      />
      <button
        type="submit"
        disabled={pending || !label.trim() || !points}
        className="text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-ink text-cream dark:bg-cream dark:text-ink disabled:opacity-40"
      >
        ✓
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Abbrechen" className="text-ink-faint px-1">✕</button>
    </form>
  );
}
