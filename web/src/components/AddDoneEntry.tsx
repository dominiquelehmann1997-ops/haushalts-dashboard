"use client";

// Quiet, additive control: lets either person log work that already happened
// but never made it onto the board (childcare, "invisible" chores, …). Tone
// matters — this exists to make that work *visible*, not to create more to do.

import { useState, useTransition, type FormEvent } from "react";

import { PERSON } from "@/lib/data";
import { addManualEntryAction } from "@/app/actions/accounts";

type LoggablePerson = "dome" | "emely";

const PEOPLE: LoggablePerson[] = ["dome", "emely"];

export function AddDoneEntry() {
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState<LoggablePerson>("emely");
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("");
  const [betreuung, setBetreuung] = useState(false);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setPerson("emely");
    setLabel("");
    setPoints("");
    setBetreuung(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    const parsedPoints = Number(points);
    if (!trimmed || !Number.isFinite(parsedPoints) || parsedPoints <= 0) return;

    startTransition(async () => {
      await addManualEntryAction({
        personKey: person,
        label: trimmed,
        points: Math.round(parsedPoints),
        source: betreuung ? "betreuung" : "nachtrag",
      });
      reset();
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft dark:text-cream/55 hover:text-ink dark:hover:text-cream/85 px-3 py-1.5 rounded-full bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07] transition-colors"
      >
        <span className="text-[14px] leading-none">+</span> Erledigt nachtragen
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white dark:bg-[#26241F] shadow-card p-4 sm:p-5 ring-1 ring-black/[0.04] dark:ring-white/5"
    >
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="min-w-0">
          <h4 className="font-display font-semibold text-ink dark:text-cream text-[15px] leading-tight">
            Erledigt nachtragen
          </h4>
          <p className="text-[12.5px] text-ink-soft dark:text-cream/50 mt-0.5">
            Für Dinge, die schon passiert sind, aber nirgends auftauchen — auch Betreuung zählt.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          aria-label="Schließen"
          className="shrink-0 w-7 h-7 grid place-items-center rounded-full text-ink-faint hover:text-ink dark:hover:text-cream/80 hover:bg-cream dark:hover:bg-white/5 transition-colors text-[13px]"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-1.5">
            Person
          </label>
          <div className="flex items-center gap-1.5">
            {PEOPLE.map((key) => {
              const p = PERSON[key];
              const active = person === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPerson(key)}
                  className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors ${
                    active ? `${p.soft} ${p.text}` : "text-ink-faint bg-cream/70 dark:bg-white/[0.04] hover:text-ink-soft"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.dot}`}></span>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-1.5">
            Aufgabe
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z. B. Nachts beim Schreien aufgestanden"
            className="w-full text-[14px] text-ink dark:text-cream/90 placeholder:text-ink-faint bg-cream/60 dark:bg-white/[0.04] rounded-xl px-3 py-2 outline-none ring-1 ring-transparent focus:ring-ink-faint/30 dark:focus:ring-cream/20 transition-shadow"
          />
        </div>

        <div className="w-[104px]">
          <label className="block text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-1.5">
            Punkte / Min
          </label>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="20"
            className="w-full text-[14px] text-ink dark:text-cream/90 placeholder:text-ink-faint bg-cream/60 dark:bg-white/[0.04] rounded-xl px-3 py-2 outline-none ring-1 ring-transparent focus:ring-ink-faint/30 dark:focus:ring-cream/20 transition-shadow tabular-nums"
          />
        </div>

        <label className="inline-flex items-center gap-2 pb-2 cursor-pointer select-none">
          <span
            className={`w-[18px] h-[18px] rounded-md grid place-items-center border-2 transition-all ${
              betreuung
                ? "bg-emely border-transparent text-white"
                : "border-ink-faint/40 text-transparent"
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6.2 4.8 8.5 9.5 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <input
            type="checkbox"
            checked={betreuung}
            onChange={(e) => setBetreuung(e.target.checked)}
            className="sr-only"
          />
          <span className="text-[13px] text-ink-soft dark:text-cream/60">Betreuung</span>
        </label>

        <button
          type="submit"
          disabled={pending || !label.trim() || !points}
          className="ml-auto text-[13px] font-semibold px-4 py-2 rounded-xl bg-ink text-cream dark:bg-cream dark:text-ink hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {pending ? "Speichert …" : "Eintragen"}
        </button>
      </div>
    </form>
  );
}
