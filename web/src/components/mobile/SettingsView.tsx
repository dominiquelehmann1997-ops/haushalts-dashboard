import type { ActivePhase } from "@/lib/repositories/phase";
import type { RoutineTemplateDTO } from "@/lib/repositories/tasks";
import { RHYTHM_OPTIONS } from "@/lib/repositories/tasks";
import { PhaseSwitch } from "@/components/PhaseSwitch";
import { PushSetupControl } from "@/components/PushSetupControl";
import { ThemeToggle } from "@/components/mobile/ThemeToggle";
import { TaskDurationsControl } from "@/components/mobile/TaskDurationsControl";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint mb-3">
      {children}
    </h2>
  );
}

export function SettingsView({
  phase,
  templates,
}: {
  phase: ActivePhase | null;
  templates: RoutineTemplateDTO[];
}) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Verwalten" title="Einstellungen" />

      <Card>
        <SectionTitle>Design</SectionTitle>
        <p className="text-[12.5px] text-ink-soft dark:text-cream/60 mb-3">
          Hell, dunkel oder automatisch nach Handy-Einstellung.
        </p>
        <ThemeToggle />
      </Card>

      <Card>
        <SectionTitle>Aufgaben-Dauer & Rhythmus</SectionTitle>
        <p className="text-[12.5px] text-ink-soft dark:text-cream/60 mb-3">
          Dauer, Rhythmus und Zuständigkeit wiederkehrender Aufgaben — gilt
          dauerhaft für alle künftigen Wiederholungen.
        </p>
        <TaskDurationsControl templates={templates} rhythmOptions={RHYTHM_OPTIONS} />
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
            Elternzeit-Modus
          </span>
          <PhaseSwitch phase={phase} />
        </div>
      </Card>

      <Card>
        <SectionTitle>Push auf diesem Handy</SectionTitle>
        <p className="text-[12.5px] text-ink-soft dark:text-cream/60 mb-3">
          Aktivieren, um benachrichtigt zu werden, sobald ein Essensplan-Entwurf bereitliegt.
        </p>
        <PushSetupControl />
      </Card>
    </div>
  );
}
