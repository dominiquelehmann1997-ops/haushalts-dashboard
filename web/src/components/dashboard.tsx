"use client";

import { useEffect, useState, useOptimistic, startTransition } from "react";
import type { Task, Appointment, Meal, Note } from "@/lib/data";
import type { CurrentWeather } from "@/integrations/weather/openMeteo";
import type { ProjectProgress } from "@/lib/repositories/projects";
import { toggleTaskAction, deferTaskAction, failTaskAction } from "@/app/actions/tasks";
import { Header } from "@/components/header";
import { TaskTile, AppointmentsTile } from "@/components/tiles";
import { MealPlanWidget, NotesWidget } from "@/components/widgets";
import { Weather } from "@/components/Weather";
import { TopbarStats } from "@/components/TopbarStats";
import { PushSetupControl } from "@/components/PushSetupControl";

export interface DashboardProps {
  initialTasks: Task[];
  weather: CurrentWeather;
  appointments: Appointment[];
  meals: Meal[];
  notes: Note[];
  project: ProjectProgress | null;
  openTaskCount: number;
  todayLabel: { weekday: string; date: string };
}

export default function Dashboard({
  initialTasks,
  weather,
  appointments,
  meals,
  notes,
  project,
  openTaskCount,
  todayLabel,
}: DashboardProps) {
  const [dark, setDark] = useState(false);

  // `useOptimistic` keeps the server prop (`initialTasks`) as the source of
  // truth — so when a Server Action revalidates the route, the new server
  // data flows in live — while still applying an instant optimistic update
  // during the pending transition.
  type TaskOptimisticAction = { id: string; type: "toggle" | "defer" | "fail" };
  const [tasks, applyTaskOptimistic] = useOptimistic(
    initialTasks,
    (state: Task[], { id, type }: TaskOptimisticAction) =>
      state.map((t) => {
        if (t.id !== id) return t;
        if (type === "toggle") {
          return t.status === "open" || t.status === "done"
            ? { ...t, status: t.status === "open" ? "done" : "open" }
            : t;
        }
        if (type === "defer") {
          return { ...t, status: "moved" };
        }
        // type === "fail"
        return { ...t, status: "failed" };
      }),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggleTask = (id: string) => {
    startTransition(async () => {
      applyTaskOptimistic({ id, type: "toggle" });
      await toggleTaskAction(id);
    });
  };
  const deferTask = (id: string) => {
    startTransition(async () => {
      applyTaskOptimistic({ id, type: "defer" });
      await deferTaskAction(id);
    });
  };
  const failTask = (id: string) => {
    startTransition(async () => {
      applyTaskOptimistic({ id, type: "fail" });
      await failTaskAction(id, "geht heute nicht");
    });
  };

  const domeTasks = tasks.filter((t) => t.person === "dome");
  const emelyTasks = tasks.filter((t) => t.person === "emely");

  return (
    <div className="h-[100svh] w-full overflow-hidden flex flex-col gap-2.5 p-2.5 sm:p-3">
      {/* Zone 1 — Topbar */}
      <section className="h-[15%] min-h-0 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr] gap-3">
        <div className="flex flex-col justify-center">
          <Header dark={dark} setDark={setDark} todayLabel={todayLabel} />
        </div>
        <TopbarStats openTaskCount={openTaskCount} project={project} />
        <Weather weather={weather} />
      </section>

      {/* Zone 2 — Primär */}
      <section className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="min-h-0 overflow-hidden">
          <TaskTile person="dome" tasks={domeTasks} onToggle={toggleTask} onDefer={deferTask} onFail={failTask} />
        </div>
        <div className="min-h-0 overflow-hidden">
          <TaskTile person="emely" tasks={emelyTasks} onToggle={toggleTask} onDefer={deferTask} onFail={failTask} />
        </div>
        <div className="min-h-0 overflow-hidden">
          <AppointmentsTile appointments={appointments} />
        </div>
        <div className="min-h-0 overflow-hidden">
          <MealPlanWidget meals={meals} />
        </div>
      </section>

      {/* Zone 2.5 — Geräte-Push-Anmeldung (nahe Essensplan) */}
      <div className="flex justify-end px-1">
        <PushSetupControl />
      </div>

      {/* Zone 3 — Notizen (read-only) */}
      <section className="h-[22%] min-h-0 overflow-hidden">
        <NotesWidget notes={notes} />
      </section>
    </div>
  );
}
