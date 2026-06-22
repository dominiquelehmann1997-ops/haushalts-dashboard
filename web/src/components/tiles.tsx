"use client";

import { useEffect, useRef, useState } from "react";
import { PERSON, type Task, type Appointment } from "@/lib/data";
import { Card, CardHead, PersonBadge } from "@/components/ui";
import { CheckIcon, CalendarGlyph } from "@/components/icons";
import { TaskActionMenu } from "@/components/TaskActionMenu";
import { AddDoneInline } from "@/components/AddDoneInline";

export function TaskRow({
  task,
  person,
  onToggle,
  onDefer,
  onFail,
  onTakeOver,
}: {
  task: Task;
  person: "dome" | "emely" | undefined;
  onToggle: (id: string) => void;
  onDefer: (id: string) => void;
  onFail: (id: string) => void;
  onTakeOver: (id: string, doerKey: "dome" | "emely") => void;
}) {
  const p = PERSON[task.person];
  const canTakeOver = person === "dome" || person === "emely";
  const otherKey: "dome" | "emely" = person === "dome" ? "emely" : "dome";
  const otherName = canTakeOver ? PERSON[otherKey].name : "";
  const done = task.status === "done";
  const moved = task.status === "moved";
  const failed = task.status === "failed";
  const interactive = task.status === "open" || task.status === "done";

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const liRef = useRef<HTMLLIElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const startPress = () => {
    if (!interactive) return;
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      const rect = liRef.current?.getBoundingClientRect();
      setMenuPosition(rect ? { x: rect.left, y: rect.bottom } : { x: 0, y: 0 });
      setMenuOpen(true);
    }, 500);
  };
  const cancelPress = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const handleClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return; // Long-Press hat Menü geöffnet — Tap nicht als Toggle werten
    }
    if (interactive) onToggle(task.id);
  };

  return (
    <li
      ref={liRef}
      className={`group relative flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-2xl transition-colors ${
        interactive ? "hover:bg-cream/70 dark:hover:bg-white/[0.03] cursor-pointer" : ""
      }`}
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
    >
      {menuOpen && (
        <TaskActionMenu
          position={menuPosition}
          onDone={() => onToggle(task.id)}
          onDefer={() => onDefer(task.id)}
          onFail={() => onFail(task.id)}
          {...(canTakeOver
            ? {
                onTakeOver: () => onTakeOver(task.id, otherKey),
                takeOverLabel: `✓ Von ${otherName} erledigt`,
              }
            : {})}
          onClose={() => setMenuOpen(false)}
        />
      )}
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
            Verschoben{task.note ? ` · ${task.note}` : " …"}
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
  onDefer,
  onFail,
  onTakeOver,
}: {
  person: "dome" | "emely";
  tasks: Task[];
  sub?: string;
  onToggle: (id: string) => void;
  onDefer: (id: string) => void;
  onFail: (id: string) => void;
  onTakeOver: (id: string, doerKey: "dome" | "emely") => void;
}) {
  const p = PERSON[person];
  const openCount = tasks.filter((t) => t.status === "open").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  return (
    <Card className={`relative overflow-hidden ring-1 ${p.ring} h-full flex flex-col`}>
      <span className={`absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full ${p.fill}`}></span>
      <CardHead
        eyebrow="Aufgaben · Heute"
        accent={p.dot}
        title={p.name}
        sub={sub}
        right={
          <div className="flex items-center gap-2">
            <span className={`shrink-0 text-[12px] font-semibold px-2.5 py-1 rounded-full ${p.soft} ${p.text}`}>
              {openCount} offen
            </span>
            <AddDoneInline person={person} />
          </div>
        }
      />
      <ul className="-my-1 flex-1 min-h-0 overflow-y-auto">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} person={person} onToggle={onToggle} onDefer={onDefer} onFail={onFail} onTakeOver={onTakeOver} />
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
    <Card className="h-full flex flex-col">
      <CardHead
        eyebrow="Termine · Heute"
        title={`${appointments.length} Termine`}
        right={<CalendarGlyph />}
      />
      <ul className="space-y-1 flex-1 min-h-0 overflow-y-auto">
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
