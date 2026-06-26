import type { Meal, Note } from "@/lib/data";
import { Card, CardHead } from "@/components/ui";
import { MealPlanControl } from "@/components/MealPlanControl";

export function MealReasonBadge({ reason, extraPortion }: { reason?: string | null; extraPortion?: boolean }) {
  if (!reason) return null;
  const isAlone = reason === "emely-allein";
  return (
    <span
      className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
        isAlone
          ? "bg-emely-tint text-emely-deep dark:bg-emely/15 dark:text-emely"
          : "bg-cream text-ink-soft dark:bg-white/10 dark:text-cream/70"
      }`}
      title={isAlone ? "Spätdienst Dome — Emely kocht allein" : "Aufwärmbar + Extraportion für Dome"}
    >
      {isAlone ? "Emely allein" : extraPortion ? "Aufwärmen · +Portion" : "Aufwärmen"}
    </span>
  );
}

export function MealPlanWidget({ meals }: { meals: Meal[] }) {
  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <CardHead eyebrow="Essensplan · Woche" title="Schnell & einfach" />
        <MealPlanControl />
      </div>
      <ul className="space-y-1.5 flex-1 min-h-0 overflow-y-auto">
        {meals.map((m) => (
          <li
            key={m.day}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${
              m.today ? "bg-emely-tint dark:bg-emely/12 ring-1 ring-emely/25" : "bg-cream/60 dark:bg-white/[0.03]"
            }`}
          >
            <span
              className={`shrink-0 w-9 h-9 rounded-full grid place-items-center font-display font-semibold text-[13px] ${
                m.today ? "bg-emely text-white" : "bg-white dark:bg-white/10 text-ink-soft dark:text-cream/60"
              }`}
            >
              {m.day}
            </span>
            <span
              className={`flex-1 min-w-0 text-[14.5px] ${
                m.today ? "font-semibold text-ink dark:text-cream" : "text-ink-soft dark:text-cream/70"
              } ${m.light ? "italic" : ""}`}
            >
              {m.dish}
            </span>
            <MealReasonBadge reason={m.reason} extraPortion={m.extraPortion} />
            {m.today && (
              <span className="ml-auto text-[10.5px] font-bold tracking-wide uppercase text-emely-deep dark:text-emely">
                Heute
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function NotesWidget({ notes }: { notes: Note[] }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHead eyebrow="Schwarzes Brett" title="Nachrichten" />
      <ul className="space-y-3 flex-1 min-h-0 overflow-y-auto">
        {notes.map((n) => (
          <li
            key={n.id}
            className={
              n.pinned
                ? "relative flex items-center gap-3.5 p-3.5 rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-300/60 dark:bg-rose-600 dark:ring-rose-400/40 animate-pulse-slow"
                : "flex items-center gap-3.5 p-3.5 rounded-2xl bg-amber-300 text-amber-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/70 dark:bg-amber-400 dark:text-amber-950"
            }
          >
            <span className="shrink-0 text-[26px] leading-none">{n.icon}</span>
            <span className="flex-1 text-[17px] font-bold leading-snug tracking-tight">{n.text}</span>
            {n.pinned && (
              <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest bg-white/25 px-2 py-1 rounded-full">
                Wichtig
              </span>
            )}
          </li>
        ))}
        {notes.length === 0 && (
          <li className="py-6 text-center text-ink-faint dark:text-cream/40 text-[13px]">Keine Nachrichten.</li>
        )}
      </ul>
    </Card>
  );
}
