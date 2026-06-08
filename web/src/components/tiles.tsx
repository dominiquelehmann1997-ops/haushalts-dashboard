import { PERSON, type Task, type Appointment } from "@/lib/data";
import type { ActivePhase } from "@/lib/repositories/phase";
import { Card, CardHead, PersonBadge } from "@/components/ui";
import { CheckIcon, CalendarGlyph } from "@/components/icons";
import { PhaseSwitch } from "@/components/PhaseSwitch";

export function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const p = PERSON[task.person];
  const done = task.status === "done";
  const moved = task.status === "moved";
  const failed = task.status === "failed";
  const interactive = task.status === "open" || task.status === "done";

  return (
    <li
      className={`group flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-2xl transition-colors ${
        interactive ? "hover:bg-cream/70 dark:hover:bg-white/[0.03] cursor-pointer" : ""
      }`}
      onClick={interactive ? () => onToggle(task.id) : undefined}
    >
      {moved ? (
        <span className="mt-0.5 shrink-0 w-[22px] h-[22px] rounded-full grid place-items-center bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-[13px]">
          ↻
        </span>
      ) : failed ? (
        <span className="mt-0.5 shrink-0 w-[22px] h-[22px] rounded-full grid place-items-center bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 text-[13px]">
          ⤬
        </span>
      ) : (
        <span
          className={`mt-0.5 shrink-0 w-[22px] h-[22px] rounded-full grid place-items-center border-2 transition-all ${
            done
              ? `${p.fill} border-transparent text-white`
              : "border-ink-faint/40 group-hover:border-ink-faint text-transparent"
          }`}
        >
          <CheckIcon />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2.5">
          <span
            className={`text-[15px] leading-snug flex-1 min-w-0 ${
              done
                ? "line-through text-ink-faint dark:text-cream/35"
                : failed
                  ? "text-rose-500/90"
                  : "text-ink dark:text-cream/90"
            } font-medium`}
          >
            <span className="mr-1.5 opacity-80">{task.icon}</span>
            {task.text}
          </span>
          {task.mins != null && !moved && (
            <span
              className={`shrink-0 mt-px text-[11px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                done
                  ? "text-ink-faint bg-black/5 dark:bg-white/5"
                  : "text-ink-soft bg-cream dark:text-cream/50 dark:bg-white/5"
              }`}
            >
              {task.mins} Min
            </span>
          )}
        </div>
        {moved && (
          <p className="text-[12.5px] text-amber-700/90 dark:text-amber-300/80 mt-0.5">
            Verschoben · {task.note}
          </p>
        )}
        {task.sub && <p className="text-[12px] text-ink-faint mt-0.5">{task.sub}</p>}
      </div>
    </li>
  );
}

export function TaskTile({
  person,
  tasks,
  sub,
  onToggle,
}: {
  person: "dome" | "emely";
  tasks: Task[];
  sub?: string;
  onToggle: (id: string) => void;
}) {
  const p = PERSON[person];
  const openCount = tasks.filter((t) => t.status === "open").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  return (
    <Card className={`relative overflow-hidden ring-1 ${p.ring}`}>
      <span className={`absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full ${p.fill}`}></span>
      <CardHead
        eyebrow="Aufgaben · Heute"
        accent={p.dot}
        title={p.name}
        sub={sub}
        right={
          <span className={`shrink-0 text-[12px] font-semibold px-2.5 py-1 rounded-full ${p.soft} ${p.text}`}>
            {openCount} offen
          </span>
        }
      />
      <ul className="-my-1">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={onToggle} />
        ))}
      </ul>
      {doneCount > 0 && (
        <p className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 text-[12px] text-ink-faint">
          {doneCount} heute schon erledigt — schön. ✓
        </p>
      )}
    </Card>
  );
}

export function AppointmentsTile({ appointments }: { appointments: Appointment[] }) {
  return (
    <Card>
      <CardHead
        eyebrow="Termine · Heute"
        title={`${appointments.length} Termine`}
        right={<CalendarGlyph />}
      />
      <ul className="space-y-1">
        {appointments.map((a, i) => (
          <li
            key={a.id}
            className={`flex items-start gap-3 py-2.5 ${
              i !== 0 ? "border-t border-black/5 dark:border-white/5" : ""
            }`}
          >
            <div className="shrink-0 text-right">
              <div className="font-display font-semibold text-[15px] text-ink dark:text-cream tabular-nums leading-tight">
                {a.time}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink dark:text-cream/90 leading-tight">
                {a.title}
              </div>
              <div className="text-[12.5px] text-ink-faint">{a.place}</div>
              {a.who.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {a.who.map((w) => (
                    <PersonBadge key={w} who={w} />
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ElternzeitStripe({
  split,
  phase,
}: {
  split: { dome: number; emely: number };
  phase: ActivePhase | null;
}) {
  const isElternzeit = phase?.mode !== "normal";

  return (
    <div className="rounded-xl2 bg-gradient-to-r from-emely-tint via-white to-dome-tint dark:from-emely/10 dark:via-[#26241F] dark:to-dome/10 shadow-card p-5 sm:p-6 ring-1 ring-black/[0.04] dark:ring-white/5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
        <div className="lg:w-[38%] shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {isElternzeit && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-dome/40"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isElternzeit ? "bg-dome" : "bg-ink-faint"}`}></span>
            </span>
            <span
              className={`whitespace-nowrap text-[11px] font-semibold tracking-[0.14em] uppercase ${
                isElternzeit ? "text-dome-deep dark:text-dome" : "text-ink-faint"
              }`}
            >
              {isElternzeit ? "Elternzeit-Modus aktiv" : "Normal-Modus"}
            </span>
          </div>
          <p className="text-[14.5px] leading-relaxed text-ink-soft dark:text-cream/60">
            {isElternzeit ? (
              <>
                <span className="font-semibold text-ink dark:text-cream/90">
                  Dome übernimmt aktuell den Großteil.
                </span>{" "}
                Emely ist den Tag über mit der Kleinen zuhause — Betreuung ist auch Arbeit.
                Hausarbeit landet bewusst nicht automatisch bei ihr.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink dark:text-cream/90">
                  Beide teilen sich die Woche.
                </span>{" "}
                Keine besondere Lebensphase aktuell — die Aufteilung orientiert sich am
                gemeinsamen Zielwert unten.
              </>
            )}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-ink-faint">
              Aufgaben-Aufteilung · diese Woche
            </div>
            <PhaseSwitch phase={phase} />
          </div>
          <div className="flex items-center justify-between text-[12.5px] font-semibold mb-2">
            <span className="flex items-center gap-1.5 text-dome-deep dark:text-dome">
              <span className="w-2 h-2 rounded-full bg-dome"></span>Dome {split.dome}%
            </span>
            <span className="flex items-center gap-1.5 text-emely-deep dark:text-emely">
              Emely {split.emely}%<span className="w-2 h-2 rounded-full bg-emely"></span>
            </span>
          </div>
          <div className="h-4 rounded-full overflow-hidden flex bg-black/5 dark:bg-white/10 shadow-inner">
            <div
              className="bg-dome h-full flex items-center justify-start pl-2.5 transition-all duration-700"
              style={{ width: split.dome + "%" }}
            >
              <span className="text-[10px] font-bold text-white/90 tracking-wide">DOME</span>
            </div>
            <div
              className="bg-emely h-full flex items-center justify-end pr-2.5 transition-all duration-700"
              style={{ width: split.emely + "%" }}
            >
              <span className="text-[10px] font-bold text-white/90 tracking-wide">EMELY</span>
            </div>
          </div>
          <p className="text-[12px] text-ink-faint mt-2">
            {isElternzeit
              ? "Ziel ist nicht 50/50 — sondern fair zur aktuellen Lebenssituation."
              : phase
                ? `Ziel: Dome ${phase.targetDome}% / Emely ${phase.targetEmely}% — fair zur aktuellen Lebenssituation.`
                : "Ziel ist nicht 50/50 — sondern fair zur aktuellen Lebenssituation."}
          </p>
        </div>
      </div>
    </div>
  );
}
