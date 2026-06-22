// web/src/components/mobile/TodayView.tsx
"use client";

import { useOptimistic, startTransition } from "react";
import type { Task, Appointment } from "@/lib/data";
import type { CurrentWeather } from "@/integrations/weather/openMeteo";
import type { ActivePhase } from "@/lib/repositories/phase";
import { toggleTaskAction, deferTaskAction, failTaskAction, completeTaskByAction } from "@/app/actions/tasks";
import { TaskTile, AppointmentsTile } from "@/components/tiles";
import { Weather } from "@/components/Weather";
import { PhaseSwitch } from "@/components/PhaseSwitch";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";
import { SyncButton } from "@/components/SyncButton";
import { PERSON } from "@/lib/data";

type Opt = { id: string; type: "toggle" | "defer" | "fail" };

export function TodayView({
  domeTasks,
  emelyTasks,
  appointments,
  weather,
  phase,
  split,
}: {
  domeTasks: Task[];
  emelyTasks: Task[];
  appointments: Appointment[];
  weather: CurrentWeather;
  phase: ActivePhase | null;
  split: { dome: number; emely: number };
}) {
  const [tasks, applyOpt] = useOptimistic(
    [...domeTasks, ...emelyTasks],
    (state: Task[], { id, type }: Opt) =>
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

  const onToggle = (id: string) => run(id, "toggle", toggleTaskAction);
  const onDefer = (id: string) => run(id, "defer", deferTaskAction);
  const onFail = (id: string) => run(id, "fail", (taskId) => failTaskAction(taskId, "geht heute nicht"));
  const onTakeOver = (id: string, doerKey: "dome" | "emely") =>
    startTransition(async () => {
      applyOpt({ id, type: "toggle" });
      await completeTaskByAction(id, doerKey);
    });

  const dome = tasks.filter((t) => t.person === "dome");
  const emely = tasks.filter((t) => t.person === "emely");

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Heute im Fokus" title="Heute" right={<SyncButton />} />

      <Weather weather={weather} />

      <TaskTile person="dome" tasks={dome} onToggle={onToggle} onDefer={onDefer} onFail={onFail} onTakeOver={onTakeOver} />
      <TaskTile person="emely" tasks={emely} onToggle={onToggle} onDefer={onDefer} onFail={onFail} onTakeOver={onTakeOver} />

      <AppointmentsTile appointments={appointments} />

      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
            {phase?.mode === "elternzeit" ? "Elternzeit-Modus" : "Aufteilung diese Woche"}
          </span>
          <PhaseSwitch phase={phase} />
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-cream dark:bg-white/10">
          <div className={`${PERSON.dome.fill} h-full`} style={{ width: `${split.dome}%` }} />
          <div className={`${PERSON.emely.fill} h-full`} style={{ width: `${split.emely}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[12px] font-semibold">
          <span className={PERSON.dome.text}>Dome {split.dome}%</span>
          <span className={PERSON.emely.text}>Emely {split.emely}%</span>
        </div>
      </Card>
    </div>
  );
}
