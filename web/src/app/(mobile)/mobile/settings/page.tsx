import { SettingsView } from "@/components/mobile/SettingsView";
import { getActivePhase } from "@/lib/repositories/phase";

export const dynamic = "force-dynamic";

export default async function MobileSettingsPage() {
  const phase = await getActivePhase();
  return <SettingsView phase={phase} />;
}
