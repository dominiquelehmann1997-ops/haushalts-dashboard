"use client";

import { useEffect, useState, useOptimistic, startTransition } from "react";
import type {
  Task,
  Appointment,
  ShoppingItem,
  Meal,
  DraftMeal,
  RecipeOption,
  Note,
} from "@/lib/data";
import type { CurrentWeather } from "@/integrations/weather/openMeteo";
import type { ActivePhase } from "@/lib/repositories/phase";
import type { ProjectProgress } from "@/lib/repositories/projects";
import type { AgeBand } from "@/lib/baby/types";
import { toggleTaskAction } from "@/app/actions/tasks";
import { toggleShoppingAction } from "@/app/actions/shopping";
import { Header } from "@/components/header";
import { TaskTile, AppointmentsTile, ElternzeitStripe } from "@/components/tiles";
import { ShoppingWidget, MealPlanWidget, NotesWidget, WeekWidget } from "@/components/widgets";
import { AddDoneEntry } from "@/components/AddDoneEntry";
import { WeatherBabyTile } from "@/components/WeatherBabyTile";
import { MealDraftPanel } from "@/components/MealDraftPanel";

export interface DashboardProps {
  initialTasks: Task[];
  initialShopping: ShoppingItem[];
  weather: CurrentWeather;
  appointments: Appointment[];
  split: { dome: number; emely: number };
  phase: ActivePhase | null;
  meals: Meal[];
  draft: DraftMeal[];
  recipes: RecipeOption[];
  notes: Note[];
  project: ProjectProgress | null;
  openTaskCount: number;
  babyAgeBand: AgeBand;
  babyAgeLabel: string;
}

export default function Dashboard({
  initialTasks,
  initialShopping,
  weather,
  appointments,
  split,
  phase,
  meals,
  draft,
  recipes,
  notes,
  project,
  openTaskCount,
  babyAgeBand,
  babyAgeLabel,
}: DashboardProps) {
  const [dark, setDark] = useState(false);

  // `useOptimistic` keeps the server props (`initialTasks`/`initialShopping`)
  // as the source of truth — so when a Server Action revalidates the route
  // (e.g. generating the meal plan adds recipe items to the shopping list),
  // the new server data flows in live — while still applying an instant
  // optimistic toggle during the pending transition.
  const [tasks, toggleTaskOptimistic] = useOptimistic(
    initialTasks,
    (state: Task[], id: string) =>
      state.map((t) =>
        t.id === id && (t.status === "open" || t.status === "done")
          ? { ...t, status: t.status === "open" ? "done" : "open" }
          : t,
      ),
  );
  const [shopping, toggleShopOptimistic] = useOptimistic(
    initialShopping,
    (state: ShoppingItem[], id: string) =>
      state.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggleTask = (id: string) => {
    startTransition(async () => {
      toggleTaskOptimistic(id);
      await toggleTaskAction(id);
    });
  };
  const toggleShop = (id: string) => {
    startTransition(async () => {
      toggleShopOptimistic(id);
      await toggleShoppingAction(id);
    });
  };

  const domeTasks = tasks.filter((t) => t.person === "dome");
  const emelyTasks = tasks.filter((t) => t.person === "emely");

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9">
        <Header dark={dark} setDark={setDark} />

        {/* HERO BAND */}
        <section className="rise" style={{ animationDelay: ".02s" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 items-start">
            <WeatherBabyTile weather={weather} ageBand={babyAgeBand} ageLabel={babyAgeLabel} />
            <TaskTile
              person="dome"
              tasks={domeTasks}
              onToggle={toggleTask}
              sub="übernimmt heute den Großteil"
            />
            <TaskTile
              person="emely"
              tasks={emelyTasks}
              onToggle={toggleTask}
              sub="bewusst wenig · nur in den Schläfchen"
            />
            <AppointmentsTile appointments={appointments} />
          </div>
          <div className="mt-4 sm:mt-5">
            <ElternzeitStripe split={split} phase={phase} />
          </div>
          <div className="mt-3 sm:mt-4">
            <AddDoneEntry />
          </div>
        </section>

        {/* WIDGET ROW */}
        <section className="mt-7 sm:mt-9 rise" style={{ animationDelay: ".12s" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 items-start">
            <ShoppingWidget items={shopping} onToggle={toggleShop} />
            <MealPlanWidget meals={meals} />
            <NotesWidget notes={notes} />
            <WeekWidget openTaskCount={openTaskCount} project={project} />
          </div>
        </section>

        {draft.length > 0 && (
          <section className="mt-4 sm:mt-5">
            <MealDraftPanel draft={draft} recipes={recipes} />
          </section>
        )}

        <footer className="mt-10 text-center text-[12px] text-ink-faint/80">
          Haushalts-Cockpit · ruhig statt vollgepackt · Mock-Demo
        </footer>
      </div>
    </div>
  );
}
