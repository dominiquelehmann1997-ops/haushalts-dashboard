import type { Note } from "@/lib/data";
import type { ActivePhase } from "@/lib/repositories/phase";
import { NotesEditor } from "@/components/mobile/NotesEditor";
import { PhaseSwitch } from "@/components/PhaseSwitch";
import { PushSetupControl } from "@/components/PushSetupControl";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";

export function MoreView({ notes, phase }: { notes: Note[]; phase: ActivePhase | null }) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Verwalten" title="Mehr" />

      <NotesEditor notes={notes} />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
            Elternzeit-Modus
          </span>
          <PhaseSwitch phase={phase} />
        </div>
      </Card>

      <Card>
        <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint mb-2">
          Push auf diesem Handy
        </h2>
        <p className="text-[12.5px] text-ink-soft dark:text-cream/60 mb-3">
          Aktivieren, um benachrichtigt zu werden, sobald ein Essensplan-Entwurf bereitliegt.
        </p>
        <PushSetupControl />
      </Card>
    </div>
  );
}
