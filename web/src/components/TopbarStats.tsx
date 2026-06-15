import type { ProjectProgress } from "@/lib/repositories/projects";

/** Schlanke Kennzahl-Chips für die Topbar (offene Aufgaben, Projekt-Fortschritt). */
export function TopbarStats({
  openTaskCount,
  project,
}: {
  openTaskCount: number;
  project: ProjectProgress | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 justify-center text-[12.5px] font-medium">
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cream/70 dark:bg-white/[0.05] text-ink-soft dark:text-cream/70">
        📊 <b className="tabular-nums text-ink dark:text-cream">{openTaskCount}</b> offene Aufgaben
      </span>
      {project && (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dome-tint dark:bg-dome/10 text-dome-deep dark:text-dome">
          {project.icon} {project.title} · <b className="tabular-nums">{project.pct}%</b>
        </span>
      )}
    </div>
  );
}
