import { MoreView } from "@/components/mobile/MoreView";
import { getNotes } from "@/lib/repositories/notes";
import { getActivePhase } from "@/lib/repositories/phase";

export const dynamic = "force-dynamic";

export default async function MobileMorePage() {
  const [notes, phase] = await Promise.all([getNotes(), getActivePhase()]);
  return <MoreView notes={notes} phase={phase} />;
}
