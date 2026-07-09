import { SettingsView } from "@/components/mobile/SettingsView";
import { getActivePhase } from "@/lib/repositories/phase";
import { listRoutineTemplates } from "@/lib/repositories/tasks";

export const dynamic = "force-dynamic";

export default async function MobileSettingsPage() {
  const [phase, templates] = await Promise.all([getActivePhase(), listRoutineTemplates()]);
  return <SettingsView phase={phase} templates={templates} />;
}
