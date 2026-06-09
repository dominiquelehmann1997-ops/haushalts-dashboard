import Dashboard from "@/components/dashboard";
import { weather as weatherFallback } from "@/lib/data";
import { getCurrent } from "@/integrations/weather/openMeteo";
import { getTasksByPerson, getOpenTaskCount } from "@/lib/repositories/tasks";
import { getTodaysEvents } from "@/lib/repositories/calendar";
import { getComputedSplit } from "@/lib/repositories/accounts";
import { getActivePhase } from "@/lib/repositories/phase";
import { getShoppingItems, getFreshShoppingState } from "@/lib/repositories/shopping";
import { getWeekMealPlan, getDraftMealPlan, listRecipes } from "@/lib/repositories/meals";
import { getNotes } from "@/lib/repositories/notes";
import { getActiveProjectProgress } from "@/lib/repositories/projects";
import { babyAge } from "@/lib/baby/age";
import { BABY } from "@/lib/baby/profile";

export default async function Home() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    domeTasks,
    emelyTasks,
    appointments,
    split,
    phase,
    shopping,
    fresh,
    meals,
    draft,
    recipes,
    notes,
    project,
    openTaskCount,
  ] = await Promise.all([
    getTasksByPerson("dome", today),
    getTasksByPerson("emely", today),
    getTodaysEvents(today),
    getComputedSplit(),
    getActivePhase(),
    getShoppingItems(),
    getFreshShoppingState(),
    getWeekMealPlan(),
    getDraftMealPlan(),
    listRecipes(),
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

  const { ageBand: babyAgeBand, label: babyAgeLabel } = babyAge(BABY.birth, today);

  return (
    <Dashboard
      initialTasks={[...domeTasks, ...emelyTasks]}
      initialShopping={shopping}
      weather={weather}
      appointments={appointments}
      split={split}
      phase={phase}
      meals={meals}
      fresh={fresh}
      draft={draft}
      recipes={recipes}
      notes={notes}
      project={project}
      openTaskCount={openTaskCount}
      babyAgeBand={babyAgeBand}
      babyAgeLabel={babyAgeLabel}
    />
  );
}
