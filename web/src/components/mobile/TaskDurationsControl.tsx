"use client";

import { useState, useTransition } from "react";
import { Minus, Plus, Check } from "lucide-react";
import type { RoutineTemplateDTO, AllowedPersons } from "@/lib/repositories/tasks";
import { updateRoutineTemplateAction } from "@/app/actions/settings";

const PERSON_OPTIONS: { value: AllowedPersons; label: string }[] = [
  { value: "both", label: "Beide" },
  { value: "dome", label: "Dome" },
  { value: "emely", label: "Emely" },
];

interface RhythmOption {
  value: string;
  label: string;
}

export function TaskDurationsControl({
  templates,
  rhythmOptions,
}: {
  templates: RoutineTemplateDTO[];
  rhythmOptions: RhythmOption[];
}) {
  if (templates.length === 0) {
    return (
      <p className="py-3 text-center text-ink-faint text-[13px]">
        Noch keine wiederkehrenden Aufgaben.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {templates.map((t) => (
        <TemplateRow key={t.chainId} template={t} rhythmOptions={rhythmOptions} />
      ))}
    </ul>
  );
}

function TemplateRow({
  template,
  rhythmOptions,
}: {
  template: RoutineTemplateDTO;
  rhythmOptions: RhythmOption[];
}) {
  const [effort, setEffort] = useState(template.effort);
  const [rhythm, setRhythm] = useState<string>(template.rhythm ?? "weekly");
  const [who, setWho] = useState<AllowedPersons>(template.allowedPersons);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const persist = (next: { effort?: number; rhythm?: string; who?: AllowedPersons }) => {
    const payload = {
      chainId: template.chainId,
      effort: next.effort ?? effort,
      rhythm: next.rhythm ?? rhythm,
      allowedPersons: next.who ?? who,
    };
    setSaved(false);
    startTransition(async () => {
      await updateRoutineTemplateAction(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  const bumpEffort = (delta: number) => {
    const next = Math.max(0, effort + delta);
    setEffort(next);
    persist({ effort: next });
  };

  return (
    <li className="rounded-2xl bg-cream/50 dark:bg-white/[0.04] p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[18px] leading-none">{template.icon || "•"}</span>
        <span className="flex-1 min-w-0 text-[14px] font-semibold text-ink dark:text-cream/90 truncate">
          {template.title}
        </span>
        {pending ? (
          <span className="text-[11px] text-ink-faint">…</span>
        ) : saved ? (
          <Check size={16} className="text-emerald-500" />
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {/* Dauer */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => bumpEffort(-5)}
            aria-label="Dauer verringern"
            className="w-8 h-8 grid place-items-center rounded-lg bg-white dark:bg-white/[0.06] text-ink-soft dark:text-cream/70 active:scale-95"
          >
            <Minus size={15} />
          </button>
          <div className="w-14 text-center tabular-nums text-[14px] font-semibold text-ink dark:text-cream/90">
            {effort}
            <span className="text-[11px] text-ink-faint font-normal"> Min</span>
          </div>
          <button
            type="button"
            onClick={() => bumpEffort(5)}
            aria-label="Dauer erhöhen"
            className="w-8 h-8 grid place-items-center rounded-lg bg-white dark:bg-white/[0.06] text-ink-soft dark:text-cream/70 active:scale-95"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* Rhythmus */}
        <select
          value={rhythm}
          onChange={(e) => {
            setRhythm(e.target.value);
            persist({ rhythm: e.target.value });
          }}
          aria-label="Rhythmus"
          className="flex-1 min-w-0 text-[13px] rounded-lg bg-white dark:bg-white/[0.06] text-ink dark:text-cream/90 px-2 py-2 outline-none"
        >
          {rhythmOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Zuständigkeit */}
      <div className="grid grid-cols-3 gap-1.5">
        {PERSON_OPTIONS.map((o) => {
          const active = who === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setWho(o.value);
                persist({ who: o.value });
              }}
              aria-pressed={active}
              className={`rounded-lg py-1.5 text-[12px] font-semibold transition-colors ${
                active
                  ? "bg-ink text-cream dark:bg-cream dark:text-ink"
                  : "bg-white text-ink-soft dark:bg-white/[0.06] dark:text-cream/60"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </li>
  );
}
