import { TasksView } from "@/components/mobile/TasksView";
import { getTasksForDay, listOpenTasks } from "@/lib/repositories/tasks";

export const dynamic = "force-dynamic";

export default async function MobileTasksPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayTasks, allOpen] = await Promise.all([getTasksForDay(today), listOpenTasks()]);
  return <TasksView todayTasks={todayTasks} allOpen={allOpen} />;
}
