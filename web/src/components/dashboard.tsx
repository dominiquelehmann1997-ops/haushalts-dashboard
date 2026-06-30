"use client";

import { useEffect, useRef, useState, useOptimistic, startTransition } from "react";
import { useRouter } from "next/navigation";
import { isDarkBySun } from "@/lib/sunTheme";
import type { Task, Appointment, Meal, Note } from "@/lib/data";
import type { CurrentWeather } from "@/integrations/weather/openMeteo";
import type { ProjectProgress } from "@/lib/repositories/projects";
import { toggleTaskAction, deferTaskAction, failTaskAction, completeTaskByAction, completeTaskByBothAction } from "@/app/actions/tasks";
import { Header } from "@/components/header";
import { TaskTile, AppointmentsTile } from "@/components/tiles";
import { MealPlanWidget, NotesWidget } from "@/components/widgets";
import { Weather } from "@/components/Weather";
import { TopbarStats } from "@/components/TopbarStats";
import { PushSetupControl } from "@/components/PushSetupControl";

/**
 * Tablet-Auto-Theme: folgt Sonnenauf-/untergang (aus dem Wetter). Startet
 * SSR-sicher hell (`false`) und übernimmt beim Mount den Sonnenstand. Ein
 * manueller Toggle (Header) setzt `dark` direkt; zwischen zwei Sonnen-Übergängen
 * tut der Minuten-Tick nichts, also bleibt die manuelle Wahl bestehen — beim
 * nächsten Auf-/Untergang setzt sich der Automatik-Wert wieder durch.
 */
function useSunTheme(sunrise: string, sunset: string) {
  const [dark, setDark] = useState(false);
  const lastSun = useRef<boolean | null>(null);
  useEffect(() => {
    const apply = () => {
      const sun = isDarkBySun(new Date(), sunrise, sunset);
      if (lastSun.current !== sun) {
        lastSun.current = sun;
        setDark(sun);
      }
    };
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [sunrise, sunset]);
  return [dark, setDark] as const;
}

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
  const [dark, setDark] = useSunTheme(weather.sunrise, weather.sunset);
  const router = useRouter();

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

  // Kiosk-Auto-Refresh: Das Tablet bleibt dauerhaft auf dieser Seite, ohne
  // Interaktion lädt sie nie neu. `router.refresh()` holt die Server-Komponenten
  // (inkl. der frisch gesynct/geprunten Termine) periodisch nach, sodass z.B.
  // ein in Google gelöschter Termin auch ohne Tippen vom Bildschirm verschwindet.
  // Zusätzlich beim Zurückkehren auf den Tab (Display wieder an).
  useEffect(() => {
    const REFRESH_MS = 5 * 60 * 1000;
    const interval = setInterval(() => router.refresh(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

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
  const takeOver = (id: string, doerKey: "dome" | "emely") => {
    startTransition(async () => {
      applyTaskOptimistic({ id, type: "toggle" });
      await completeTaskByAction(id, doerKey);
    });
  };
  const completeBoth = (id: string) => {
    startTransition(async () => {
      applyTaskOptimistic({ id, type: "toggle" });
      await completeTaskByBothAction(id);
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
          <TaskTile person="dome" tasks={domeTasks} onToggle={toggleTask} onDefer={deferTask} onFail={failTask} onTakeOver={takeOver} onCompleteBoth={completeBoth} />
        </div>
        <div className="min-h-0 overflow-hidden">
          <TaskTile person="emely" tasks={emelyTasks} onToggle={toggleTask} onDefer={deferTask} onFail={failTask} onTakeOver={takeOver} onCompleteBoth={completeBoth} />
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
