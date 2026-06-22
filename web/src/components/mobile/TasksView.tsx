// web/src/components/mobile/TasksView.tsx
"use client";

import { useState, useOptimistic, startTransition } from "react";
import type { Task } from "@/lib/data";
import type { OpenTaskDTO } from "@/lib/repositories/tasks";
import { toggleTaskAction, deferTaskAction, failTaskAction, addTaskAction, completeTaskByAction } from "@/app/actions/tasks";
import { TaskRow } from "@/components/tiles";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";

type Opt = { id: string; type: "toggle" | "defer" | "fail" };

export function TasksView({ todayTasks, allOpen }: { todayTasks: Task[]; allOpen: OpenTaskDTO[] }) {
  const [tasks, applyOpt] = useOptimistic(todayTasks, (state: Task[], { id, type }: Opt) =>
    state.map((t) => {
      if (t.id !== id) return t;
      if (type === "toggle") return { ...t, status: t.status === "open" ? "done" : "open" };
      if (type === "defer") return { ...t, status: "moved" };
      return { ...t, status: "failed" };
    }),
  );

  const run = (id: string, type: Opt["type"], action: (id: string) => Promise<void>) =>
    startTransition(async () => {
      applyOpt({ id, type });
      await action(id);
    });

  const [addOpen, setAddOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Steuerung"
        title="Aufgaben"
        right={
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            aria-label="Neue Aufgabe"
            className="shrink-0 w-10 h-10 grid place-items-center rounded-full bg-ink text-cream dark:bg-cream dark:text-ink text-[22px] leading-none shadow-card"
          >
            +
          </button>
        }
      />

      {addOpen && <QuickAddForm onDone={() => setAddOpen(false)} />}

      <Card>
        <ul className="-my-1">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              person={t.person}
              onToggle={(id) => run(id, "toggle", toggleTaskAction)}
              onDefer={(id) => run(id, "defer", deferTaskAction)}
              onFail={(id) => run(id, "fail", (taskId) => failTaskAction(taskId, "geht heute nicht"))}
              onTakeOver={(id, doerKey) =>
                startTransition(async () => {
                  applyOpt({ id, type: "toggle" });
                  await completeTaskByAction(id, doerKey);
                })
              }
            />
          ))}
          {tasks.length === 0 && <li className="py-6 text-center text-ink-faint text-[14px]">Heute nichts offen.</li>}
        </ul>
      </Card>

      <button
        type="button"
        onClick={() => setPickOpen((v) => !v)}
        className="w-full text-[13px] font-semibold text-ink-soft dark:text-cream/70 bg-white dark:bg-[#26241F] rounded-xl2 shadow-card py-3"
      >
        Erledigt nachtragen — Aufgabe wählen
      </button>

      {pickOpen && <CompleteExistingPicker tasks={allOpen} onPicked={() => setPickOpen(false)} />}
    </div>
  );
}

function QuickAddForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState("15");
  const [who, setWho] = useState<"both" | "dome" | "emely">("both");
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const eff = Number(effort);
    if (!t || !Number.isFinite(eff) || eff <= 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setPending(true);
    startTransition(async () => {
      try {
        await addTaskAction({
          title: t,
          effort: Math.round(eff),
          allowedPersons: who,
          dueDateISO: today.toISOString(),
          assignToKey: who === "both" ? null : who,
        });
        setTitle("");
        setEffort("15");
        onDone();
      } finally {
        setPending(false);
      }
    });
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Was ist zu tun?"
          autoFocus
          className="w-full text-[15px] bg-cream/60 dark:bg-white/[0.05] rounded-xl px-3 py-2.5 outline-none text-ink dark:text-cream/90 placeholder:text-ink-faint"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="w-20 text-[14px] bg-cream/60 dark:bg-white/[0.05] rounded-xl px-3 py-2 outline-none tabular-nums text-ink dark:text-cream/90"
          />
          <span className="text-[13px] text-ink-faint">Min</span>
          <div className="ml-auto flex gap-1.5">
            {(["both", "dome", "emely"] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWho(w)}
                className={`px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors ${
                  who === w ? "bg-ink text-cream dark:bg-cream dark:text-ink" : "bg-cream/70 dark:bg-white/[0.05] text-ink-soft"
                }`}
              >
                {w === "both" ? "Beide" : w === "dome" ? "Dome" : "Emely"}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="w-full py-2.5 rounded-xl bg-dome text-white font-semibold text-[14px] disabled:opacity-40"
        >
          Aufgabe anlegen
        </button>
      </form>
    </Card>
  );
}

function CompleteExistingPicker({ tasks, onPicked }: { tasks: OpenTaskDTO[]; onPicked: () => void }) {
  const complete = (id: string) =>
    startTransition(async () => {
      await toggleTaskAction(id); // open -> done; triggers recurrence restart + EWMA
      onPicked();
    });

  return (
    <Card>
      <p className="text-[12.5px] text-ink-soft dark:text-cream/60 mb-3">
        Aufgabe als erledigt markieren — startet das Intervall neu und passt es an.
      </p>
      <ul className="divide-y divide-black/5 dark:divide-white/5">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <span className="text-[15px]">{t.icon || "•"}</span>
            <span className="flex-1 min-w-0 text-[14px] text-ink dark:text-cream/90 truncate">{t.title}</span>
            {t.rhythm && <span className="text-[11px] text-ink-faint">{t.rhythm}</span>}
            <button
              type="button"
              onClick={() => complete(t.id)}
              className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-dome-soft text-dome-deep dark:bg-dome/20 dark:text-dome"
            >
              Erledigt ✓
            </button>
          </li>
        ))}
        {tasks.length === 0 && <li className="py-4 text-center text-ink-faint text-[13px]">Keine offenen Aufgaben.</li>}
      </ul>
    </Card>
  );
}
