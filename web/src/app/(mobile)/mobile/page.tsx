import { TodayView } from "@/components/mobile/TodayView";
import { weather as weatherFallback } from "@/lib/data";
import { getCurrent } from "@/integrations/weather/openMeteo";
import { getTasksByPerson } from "@/lib/repositories/tasks";
import { getTodaysEvents } from "@/lib/repositories/calendar";
import { getActivePhase } from "@/lib/repositories/phase";
import { getComputedSplit } from "@/lib/repositories/accounts";

export const dynamic = "force-dynamic";

export default async function MobileTodayPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [domeTasks, emelyTasks, appointments, phase, split] = await Promise.all([
    getTasksByPerson("dome", today),
    getTasksByPerson("emely", today),
    getTodaysEvents(today),
    getActivePhase(),
    getComputedSplit(),
  ]);

  let weather = weatherFallback;
  try {
    weather = await getCurrent();
  } catch {
    weather = weatherFallback;
  }

  return (
    <TodayView
      domeTasks={domeTasks}
      emelyTasks={emelyTasks}
      appointments={appointments}
      weather={weather}
      phase={phase}
      split={split}
    />
  );
}
