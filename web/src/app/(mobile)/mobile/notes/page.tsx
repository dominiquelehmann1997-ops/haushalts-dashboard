import { NotesView } from "@/components/mobile/NotesView";
import { getNotes } from "@/lib/repositories/notes";

export const dynamic = "force-dynamic";

export default async function MobileNotesPage() {
  const notes = await getNotes();
  return <NotesView notes={notes} />;
}
