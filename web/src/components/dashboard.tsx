"use client";

import { useEffect, useState } from "react";
import { initialTasks, initialShopping } from "@/lib/data";
import { Header } from "@/components/header";
import { WeatherTile, TaskTile, AppointmentsTile, ElternzeitStripe } from "@/components/tiles";
import { ShoppingWidget, MealPlanWidget, NotesWidget, WeekWidget } from "@/components/widgets";

export default function Dashboard() {
  const [dark, setDark] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [shopping, setShopping] = useState(initialShopping);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggleTask = (id: string) =>
    setTasks((ts) =>
      ts.map((t) =>
        t.id === id && (t.status === "open" || t.status === "done")
          ? { ...t, status: t.status === "open" ? "done" : "open" }
          : t,
      ),
    );
  const toggleShop = (id: string) =>
    setShopping((s) => s.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  const domeTasks = tasks.filter((t) => t.person === "dome");
  const emelyTasks = tasks.filter((t) => t.person === "emely");

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9">
        <Header dark={dark} setDark={setDark} />

        {/* HERO BAND */}
        <section className="rise" style={{ animationDelay: ".02s" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
            <WeatherTile />
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
            <AppointmentsTile />
          </div>
          <div className="mt-4 sm:mt-5">
            <ElternzeitStripe />
          </div>
        </section>

        {/* WIDGET ROW */}
        <section className="mt-7 sm:mt-9 rise" style={{ animationDelay: ".12s" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 items-start">
            <ShoppingWidget items={shopping} onToggle={toggleShop} />
            <MealPlanWidget />
            <NotesWidget />
            <WeekWidget />
          </div>
        </section>

        <footer className="mt-10 text-center text-[12px] text-ink-faint/80">
          Haushalts-Cockpit · ruhig statt vollgepackt · Mock-Demo
        </footer>
      </div>
    </div>
  );
}
