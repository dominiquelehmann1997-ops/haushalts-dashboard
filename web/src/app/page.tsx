import Dashboard from "@/components/dashboard";
import { weather as weatherFallback } from "@/lib/data";
import { getCurrent } from "@/integrations/weather/openMeteo";
import { getTasksByPerson, getOpenTaskCount } from "@/lib/repositories/tasks";
import { getTodaysEvents } from "@/lib/repositories/calendar";
import { getWeekMealPlan } from "@/lib/repositories/meals";
import { getNotes } from "@/lib/repositories/notes";
import { getActiveProjectProgress } from "@/lib/repositories/projects";

// Render at request time, not build time: the dashboard depends on the current
// date (today's tasks, baby age) and live DB state. Without this, `npm run build`
// statically prerenders `/` and freezes `new Date()` to the build moment.
export const dynamic = "force-dynamic";

export default async function Home() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayLabel = {
    weekday: today.toLocaleDateString("de-DE", { weekday: "long" }),
    date: today.toLocaleDateString("de-DE", { day: "numeric", month: "long" }),
  };

  const [domeTasks, emelyTasks, appointments, meals, notes, project, openTaskCount] =
    await Promise.all([
      getTasksByPerson("dome", today),
      getTasksByPerson("emely", today),
      getTodaysEvents(today),
      getWeekMealPlan(),
      getNotes(),
      getActiveProjectProgress(),
      getOpenTaskCount(),
    ]);

  let weather = weatherFallback;
  try {
    weather = await getCurrent();
  } catch {
    weather = weatherFallback;
  }

  return (
    <Dashboard
      initialTasks={[...domeTasks, ...emelyTasks]}
      weather={weather}
      appointments={appointments}
      meals={meals}
      notes={notes}
      project={project}
      openTaskCount={openTaskCount}
      todayLabel={todayLabel}
    />
  );
}
