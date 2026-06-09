import type { ShoppingItem, Meal, Note } from "@/lib/data";
import type { ProjectProgress } from "@/lib/repositories/projects";
import { Card, CardHead } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { BringSyncControl } from "@/components/BringSyncControl";
import { MealPlanControl } from "@/components/MealPlanControl";

export function ShoppingWidget({
  items,
  onToggle,
}: {
  items: ShoppingItem[];
  onToggle: (id: string) => void;
}) {
  const left = items.filter((i) => !i.done).length;
  return (
    <Card>
      <CardHead
        eyebrow="Einkaufsliste"
        title={`${left} Artikel offen`}
        right={<BringSyncControl items={items} />}
      />
      <ul className="-mx-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            onClick={() => onToggle(item.id)}
            className="group flex items-center gap-3 px-1.5 py-2 rounded-xl hover:bg-cream/70 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
          >
            <span
              className={`shrink-0 w-[20px] h-[20px] rounded-md grid place-items-center border-2 transition-all ${
                item.done
                  ? "bg-dome border-transparent text-white"
                  : "border-ink-faint/40 group-hover:border-ink-faint text-transparent"
              }`}
            >
              <CheckIcon size={11} />
            </span>
            <span
              className={`text-[14.5px] flex-1 ${
                item.done ? "line-through text-ink-faint dark:text-cream/35" : "text-ink dark:text-cream/85"
              }`}
            >
              {item.text}
            </span>
            {item.meal && (
              <span title="Zutat aus dem Essensplan" className="text-[12px] opacity-70">
                🍽️
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function MealPlanWidget({ meals }: { meals: Meal[] }) {
  return (
    <Card>
      <CardHead eyebrow="Essensplan · Woche" title="Schnell & einfach" right={<MealPlanControl />} />
      <ul className="space-y-1.5">
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
              className={`text-[14.5px] ${
                m.today ? "font-semibold text-ink dark:text-cream" : "text-ink-soft dark:text-cream/70"
              } ${m.light ? "italic" : ""}`}
            >
              {m.dish}
            </span>
            {m.reason && (
              <span
                className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                  m.reason === "emely-allein"
                    ? "bg-emely-tint text-emely-deep dark:bg-emely/15 dark:text-emely"
                    : "bg-cream text-ink-soft dark:bg-white/10 dark:text-cream/70"
                }`}
                title={
                  m.reason === "emely-allein"
                    ? "Spätdienst Dome — Emely kocht allein"
                    : "Aufwärmbar + Extraportion für Dome"
                }
              >
                {m.reason === "emely-allein"
                  ? "Emely allein"
                  : m.extraPortion
                    ? "Aufwärmen · +Portion"
                    : "Aufwärmen"}
              </span>
            )}
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
    <Card>
      <CardHead eyebrow="Schwarzes Brett" title="Notizen" />
      <ul className="space-y-2.5">
        {notes.map((n) => (
          <li
            key={n.id}
            className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-500/[0.07] ring-1 ring-amber-200/50 dark:ring-amber-500/10"
          >
            <span className="text-[16px] leading-none mt-0.5">{n.icon}</span>
            <span className="text-[14px] text-ink dark:text-cream/85 leading-snug">{n.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function WeekWidget({
  openTaskCount,
  project,
}: {
  openTaskCount: number;
  project: ProjectProgress | null;
}) {
  return (
    <Card>
      <CardHead eyebrow="Wochenübersicht" title="Stand der Woche" />
      <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-cream/60 dark:bg-white/[0.03] mb-4">
        <span className="font-display font-semibold text-[34px] leading-none text-ink dark:text-cream tabular-nums">
          {openTaskCount}
        </span>
        <span className="text-[13.5px] text-ink-soft dark:text-cream/55 leading-snug">
          offene Aufgaben
          <br />
          über die Woche verteilt
        </span>
      </div>
      {project && (
        <div className="p-3.5 rounded-2xl ring-1 ring-dome/20 bg-dome-tint dark:bg-dome/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[15px]">{project.icon}</span>
              <span className="text-[13.5px] font-semibold text-ink dark:text-cream/90 truncate">
                {project.title}
              </span>
            </div>
            <span className="text-[12px] font-semibold text-dome-deep dark:text-dome shrink-0">
              {project.done}/{project.total}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-dome transition-all duration-700"
              style={{ width: project.pct + "%" }}
            ></div>
          </div>
          <p className="text-[11.5px] text-ink-faint mt-2">
            Laufendes Projekt · {project.pct}% geschafft
          </p>
        </div>
      )}
    </Card>
  );
}
