import type { ReactNode } from "react";
import { PERSON, type PersonKey } from "@/lib/data";

export function Card({
  className = "",
  children,
  pad = true,
}: {
  className?: string;
  children: ReactNode;
  pad?: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-[#26241F] rounded-xl2 shadow-card ${pad ? "p-5 sm:p-6" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHead({
  eyebrow,
  title,
  accent,
  right,
  sub,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  right?: ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 mb-1">
            {accent && <span className={`w-2.5 h-2.5 rounded-full ${accent}`}></span>}
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
              {eyebrow}
            </span>
          </div>
        )}
        <h3 className="font-display font-semibold text-ink dark:text-cream leading-tight text-[19px]">
          {title}
        </h3>
        {sub && <p className="text-[13px] text-ink-soft dark:text-cream/50 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PersonBadge({ who }: { who: PersonKey }) {
  const p = PERSON[who];
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full ${p.soft} ${p.text} text-[12px] font-semibold`}
    >
      <span className={`w-2 h-2 rounded-full ${p.dot}`}></span>
      {p.name}
    </span>
  );
}
