"use client";

// Routinen-Verwaltung (Handy): alle wiederkehrenden Aufgaben mit ihrem
// Intervall — anlegen, bearbeiten, beenden. Ersetzt die frühere
// "Aufgaben-Dauer & Rhythmus"-Karte in den Einstellungen, damit es nur EINE
// Stelle gibt, an der Routinen gepflegt werden.
//
// Bearbeiten speichert sofort (Muster der abgelösten TaskDurationsControl):
// jede Änderung ruft die Action, ein "…"/Häkchen zeigt den Stand. Kein Modal —
// die Codebase kennt keine; Anlegen klappt inline auf wie in TasksView.

import { useState, useTransition } from "react";
import { Check, Minus, Plus, Trash2 } from "lucide-react";

import type { AllowedPersons, RoutineTemplateDTO } from "@/lib/repositories/tasks";
import {
  CUSTOM_RHYTHM_MAX_DAYS,
  RHYTHM_OPTIONS,
  makeCustomRhythm,
  parseCustomRhythm,
  rhythmLabel,
} from "@/lib/rhythm";
import {
  createRoutineAction,
  deleteRoutineAction,
  updateRoutineAction,
  type RoutineFieldsInput,
} from "@/app/actions/routines";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";

const PERSON_OPTIONS: { value: AllowedPersons; label: string }[] = [
  { value: "both", label: "Beide" },
  { value: "dome", label: "Dome" },
  { value: "emely", label: "Emely" },
];

/** Sentinel im Rhythmus-Select für "freies Intervall". */
const CUSTOM = "__custom__";
/** Sentinel im Rhythmus-Select für eine Routine ganz ohne Rhythmus. */
const NONE = "__none__";

interface WeatherFields {
  noRain: boolean;
  minTemp: number | null;
}

/** Liest die gespeicherte Wetterbedingung; defekter JSON wird zu "keine". */
function parseWeather(raw: string | null): WeatherFields {
  if (!raw) return { noRain: false, minTemp: null };
  try {
    const parsed = JSON.parse(raw) as { noRain?: unknown; minTemp?: unknown };
    return {
      noRain: parsed.noRain === true,
      minTemp: typeof parsed.minTemp === "number" ? parsed.minTemp : null,
    };
  } catch {
    return { noRain: false, minTemp: null };
  }
}

function isPreset(rhythm: string): boolean {
  return RHYTHM_OPTIONS.some((o) => o.value === rhythm);
}

function formatDue(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "—", overdue: false };
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    text: due.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }),
    overdue: due.getTime() < today.getTime(),
  };
}

// ─── Seite ──────────────────────────────────────────────────────────────────

export function RoutinesView({ templates }: { templates: RoutineTemplateDTO[] }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Verwalten"
        title="Routinen"
        right={
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            aria-label="Neue Routine"
            className="shrink-0 w-10 h-10 grid place-items-center rounded-full bg-ink text-cream dark:bg-cream dark:text-ink text-[22px] leading-none shadow-card"
          >
            +
          </button>
        }
      />

      {addOpen && <RoutineCreateForm onDone={() => setAddOpen(false)} />}

      {templates.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-ink-faint text-[13px]">
            Noch keine wiederkehrenden Aufgaben.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <RoutineEditorCard key={t.chainId} template={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Bearbeiten ─────────────────────────────────────────────────────────────

function RoutineEditorCard({ template }: { template: RoutineTemplateDTO }) {
  const initialWeather = parseWeather(template.weatherCondition);

  const [title, setTitle] = useState(template.title);
  const [icon, setIcon] = useState(template.icon);
  const [effort, setEffort] = useState(template.effort);
  const [rhythm, setRhythm] = useState<string | null>(template.rhythm);
  const [who, setWho] = useState<AllowedPersons>(template.allowedPersons);
  const [outdoor, setOutdoor] = useState(template.outdoor);
  const [weather, setWeather] = useState<WeatherFields>(initialWeather);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Schickt immer den vollen Feldsatz — `next` überschreibt einzelne Werte. */
  const persist = (next: Partial<RoutineFieldsInput>) => {
    const payload: RoutineFieldsInput & { chainId: string } = {
      chainId: template.chainId,
      title,
      icon,
      effort,
      rhythm,
      allowedPersons: who,
      outdoor,
      noRain: weather.noRain,
      minTemp: weather.minTemp,
      ...next,
    };
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await updateRoutineAction(payload);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
    });
  };

  const bumpEffort = (delta: number) => {
    const next = Math.max(0, effort + delta);
    setEffort(next);
    persist({ effort: next });
  };

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed === template.title || trimmed === "") {
      setTitle(template.title);
      return;
    }
    setTitle(trimmed);
    persist({ title: trimmed });
  };

  const applyOutdoor = (value: boolean) => {
    setOutdoor(value);
    // Ohne Outdoor ist die Wetterbedingung wirkungslos — im UI gleich mit
    // zurücksetzen, damit die Anzeige nicht behauptet, sie gälte noch.
    const nextWeather = value ? weather : { noRain: false, minTemp: null };
    setWeather(nextWeather);
    persist({ outdoor: value, noRain: nextWeather.noRain, minTemp: nextWeather.minTemp });
  };

  const remove = () => {
    startTransition(async () => {
      try {
        await deleteRoutineAction(template.chainId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Beenden fehlgeschlagen.");
        setConfirmDelete(false);
      }
    });
  };

  const due = formatDue(template.nextDueISO);

  return (
    <li className="rounded-2xl bg-white dark:bg-[#26241F] shadow-card p-3 space-y-3">
      {/* Kopf: Icon, Titel, Speicher-Indikator */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          onBlur={() => icon !== template.icon && persist({ icon })}
          aria-label="Symbol"
          placeholder="•"
          className="w-9 h-9 shrink-0 text-center text-[18px] rounded-lg bg-cream/60 dark:bg-white/[0.05] outline-none"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label="Titel"
          className="flex-1 min-w-0 text-[14px] font-semibold bg-transparent text-ink dark:text-cream/90 outline-none focus:bg-cream/60 dark:focus:bg-white/[0.05] rounded-lg px-2 py-1.5"
        />
        {pending ? (
          <span className="text-[11px] text-ink-faint">…</span>
        ) : saved ? (
          <Check size={16} className="text-emerald-500" />
        ) : null}
      </div>

      <p className="text-[11.5px] text-ink-faint px-0.5">
        {rhythmLabel(rhythm)} · Fällig:{" "}
        <span className={due.overdue ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
          {due.text}
        </span>
      </p>

      {/* Dauer + Rhythmus */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => bumpEffort(-5)}
            aria-label="Dauer verringern"
            className="w-8 h-8 grid place-items-center rounded-lg bg-cream/60 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70 active:scale-95"
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
            className="w-8 h-8 grid place-items-center rounded-lg bg-cream/60 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70 active:scale-95"
          >
            <Plus size={15} />
          </button>
        </div>

        <RhythmPicker
          rhythm={rhythm}
          onChange={(next) => {
            setRhythm(next);
            persist({ rhythm: next });
          }}
        />
      </div>

      <PersonSegment value={who} onChange={(v) => { setWho(v); persist({ allowedPersons: v }); }} />

      <WeatherControls
        outdoor={outdoor}
        weather={weather}
        onOutdoor={applyOutdoor}
        onWeather={(next, commit) => {
          setWeather(next);
          if (commit) persist({ noRain: next.noRain, minTemp: next.minTemp });
        }}
      />

      {error && <p className="text-[12px] text-rose-600 dark:text-rose-400">{error}</p>}

      {/* Beenden — zweistufig im selben Button, statt Modal */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-ink-faint">Erledigte bleiben in der Historie.</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 4000);
              return;
            }
            remove();
          }}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors disabled:opacity-40 ${
            confirmDelete
              ? "bg-rose-600 text-white"
              : "bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/60"
          }`}
        >
          <Trash2 size={13} />
          {confirmDelete ? "Wirklich beenden?" : "Beenden"}
        </button>
      </div>
    </li>
  );
}

// ─── Anlegen ────────────────────────────────────────────────────────────────

function RoutineCreateForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [effort, setEffort] = useState("15");
  const [rhythm, setRhythm] = useState<string | null>("weekly");
  const [who, setWho] = useState<AllowedPersons>("both");
  const [outdoor, setOutdoor] = useState(false);
  const [weather, setWeather] = useState<WeatherFields>({ noRain: false, minTemp: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    const minutes = Number(effort);
    if (!trimmed || !Number.isFinite(minutes) || minutes < 0) return;
    if (rhythm === null) {
      setError("Bitte einen Rhythmus wählen.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await createRoutineAction({
          title: trimmed,
          icon,
          effort: Math.round(minutes),
          rhythm,
          allowedPersons: who,
          outdoor,
          noRain: weather.noRain,
          minTemp: weather.minTemp,
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen.");
      }
    });
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            aria-label="Symbol"
            placeholder="🧽"
            className="w-11 h-11 shrink-0 text-center text-[18px] rounded-xl bg-cream/60 dark:bg-white/[0.05] outline-none"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Was soll regelmäßig passieren?"
            autoFocus
            className="flex-1 min-w-0 text-[15px] bg-cream/60 dark:bg-white/[0.05] rounded-xl px-3 py-2.5 outline-none text-ink dark:text-cream/90 placeholder:text-ink-faint"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            aria-label="Dauer in Minuten"
            className="w-20 text-[14px] bg-cream/60 dark:bg-white/[0.05] rounded-xl px-3 py-2 outline-none tabular-nums text-ink dark:text-cream/90"
          />
          <span className="text-[13px] text-ink-faint">Min</span>
          <div className="flex-1 min-w-0">
            <RhythmPicker rhythm={rhythm} onChange={setRhythm} allowNone={false} />
          </div>
        </div>

        <PersonSegment value={who} onChange={setWho} />

        <WeatherControls
          outdoor={outdoor}
          weather={weather}
          onOutdoor={(v) => {
            setOutdoor(v);
            if (!v) setWeather({ noRain: false, minTemp: null });
          }}
          onWeather={(next) => setWeather(next)}
        />

        {error && <p className="text-[12px] text-rose-600 dark:text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="w-full py-2.5 rounded-xl bg-dome text-white font-semibold text-[14px] disabled:opacity-40"
        >
          Routine anlegen
        </button>
      </form>
    </Card>
  );
}

// ─── Geteilte Bedienelemente ────────────────────────────────────────────────

/**
 * Rhythmus-Auswahl: Presets, dazu "Alle N Tage…" mit Zahlenfeld. `allowNone`
 * blendet eine Option für Routinen ohne Rhythmus ein — sichtbar statt still auf
 * "wöchentlich" umgeschrieben (so verhielt sich die alte Steuerung).
 */
function RhythmPicker({
  rhythm,
  onChange,
  allowNone = true,
}: {
  rhythm: string | null;
  onChange: (next: string | null) => void;
  allowNone?: boolean;
}) {
  const customDays = rhythm !== null && !isPreset(rhythm) ? parseCustomRhythm(rhythm) : null;
  const isCustom = customDays !== null;
  const selectValue = rhythm === null ? NONE : isCustom ? CUSTOM : rhythm;

  // Das Zahlenfeld hat einen eigenen Entwurf und meldet erst beim Verlassen.
  // Sonst würde die Eingabe "10" unterwegs als "1 Tag" gespeichert — und ein
  // Rhythmuswechsel plant sofort den offenen Termin um.
  const [draft, setDraft] = useState(String(customDays ?? ""));

  const commitDraft = () => {
    const days = Number(draft);
    if (!Number.isFinite(days) || draft.trim() === "") {
      setDraft(String(customDays ?? ""));
      return;
    }
    const clamped = Math.min(Math.max(Math.round(days), 1), CUSTOM_RHYTHM_MAX_DAYS);
    setDraft(String(clamped));
    if (clamped !== customDays) onChange(makeCustomRhythm(clamped));
  };

  return (
    <div className="flex-1 min-w-0 flex items-center gap-1.5">
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === NONE) return onChange(null);
          if (v === CUSTOM) {
            // Beim Umschalten auf "frei" mit einem plausiblen Startwert beginnen.
            const days = customDays ?? 10;
            setDraft(String(days));
            return onChange(makeCustomRhythm(days));
          }
          onChange(v);
        }}
        aria-label="Rhythmus"
        className="flex-1 min-w-0 text-[13px] rounded-lg bg-cream/60 dark:bg-white/[0.06] text-ink dark:text-cream/90 px-2 py-2 outline-none"
      >
        {rhythm === null && allowNone && <option value={NONE}>Kein Rhythmus</option>}
        {RHYTHM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM}>Alle N Tage…</option>
      </select>

      {isCustom && (
        <input
          type="number"
          min={1}
          max={CUSTOM_RHYTHM_MAX_DAYS}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label="Intervall in Tagen"
          className="w-16 shrink-0 text-[13px] text-center tabular-nums rounded-lg bg-cream/60 dark:bg-white/[0.06] text-ink dark:text-cream/90 px-1 py-2 outline-none"
        />
      )}
    </div>
  );
}

function PersonSegment({
  value,
  onChange,
}: {
  value: AllowedPersons;
  onChange: (next: AllowedPersons) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {PERSON_OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`rounded-lg py-1.5 text-[12px] font-semibold transition-colors ${
              active
                ? "bg-ink text-cream dark:bg-cream dark:text-ink"
                : "bg-cream/70 text-ink-soft dark:bg-white/[0.06] dark:text-cream/60"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Outdoor-Schalter und Wetterbedingung. Die Bedingung wirkt nur für
 * Outdoor-Aufgaben — deshalb erscheint sie auch erst dann.
 */
function WeatherControls({
  outdoor,
  weather,
  onOutdoor,
  onWeather,
}: {
  outdoor: boolean;
  weather: WeatherFields;
  onOutdoor: (next: boolean) => void;
  /** `commit` = jetzt speichern; ohne = nur den lokalen Entwurf mitführen. */
  onWeather: (next: WeatherFields, commit: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onOutdoor(!outdoor)}
        aria-pressed={outdoor}
        className={`px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors ${
          outdoor
            ? "bg-ink text-cream dark:bg-cream dark:text-ink"
            : "bg-cream/70 text-ink-soft dark:bg-white/[0.06] dark:text-cream/60"
        }`}
      >
        Draußen
      </button>

      {outdoor && (
        <>
          <button
            type="button"
            onClick={() => onWeather({ ...weather, noRain: !weather.noRain }, true)}
            aria-pressed={weather.noRain}
            className={`px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors ${
              weather.noRain
                ? "bg-dome-soft text-dome-deep dark:bg-dome/20 dark:text-dome"
                : "bg-cream/70 text-ink-soft dark:bg-white/[0.06] dark:text-cream/60"
            }`}
          >
            Nur ohne Regen
          </button>
          <input
            type="number"
            inputMode="numeric"
            placeholder="min °C"
            value={weather.minTemp ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const parsed = raw === "" ? null : Number(raw);
              onWeather(
                { ...weather, minTemp: parsed === null || !Number.isFinite(parsed) ? null : parsed },
                false,
              );
            }}
            onBlur={() => onWeather(weather, true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="Mindesttemperatur in Grad"
            className="w-20 shrink-0 text-[12px] text-center tabular-nums rounded-full bg-cream/70 dark:bg-white/[0.06] text-ink dark:text-cream/90 px-2 py-1 outline-none placeholder:text-ink-faint"
          />
        </>
      )}
    </div>
  );
}
