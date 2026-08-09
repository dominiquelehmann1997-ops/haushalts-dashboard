import { listRoutineTemplates } from "@/lib/repositories/tasks";
import { RoutinesView } from "@/components/mobile/RoutinesView";

export const dynamic = "force-dynamic";

export default async function MobileRoutinesPage() {
  const templates = await listRoutineTemplates();
  return <RoutinesView templates={templates} />;
}
