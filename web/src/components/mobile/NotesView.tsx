import type { Note } from "@/lib/data";
import { NotesEditor } from "@/components/mobile/NotesEditor";
import { PageHeader } from "@/components/mobile/PageHeader";

export function NotesView({ notes }: { notes: Note[] }) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Merken" title="Notizen" />
      <NotesEditor notes={notes} />
    </div>
  );
}
