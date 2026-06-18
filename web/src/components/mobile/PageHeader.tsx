import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  accentDot,
  right,
}: {
  eyebrow?: string;
  title: string;
  accentDot?: string; // e.g. "bg-dome" | "bg-emely"
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 mb-1">
            {accentDot && <span className={`w-2.5 h-2.5 rounded-full ${accentDot}`} />}
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="font-display font-semibold text-ink dark:text-cream leading-tight text-[26px]">
          {title}
        </h1>
      </div>
      {right}
    </div>
  );
}
