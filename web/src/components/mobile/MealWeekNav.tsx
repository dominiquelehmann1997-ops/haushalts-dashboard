// Wochen-Umschalter des Essensplans: blättert über `?w=<offset>` zwischen den
// ISO-Wochen. Damit lässt sich eine Woche vorausplanen, bevor sie startet.
// Die erlaubte Spanne steht in `@/lib/weekOffset`.

import Link from "next/link";

import { formatWeekRange, weekOffsetLabel, weekStartWithOffset } from "@/lib/dates";
import { MAX_WEEK_OFFSET, MIN_WEEK_OFFSET } from "@/lib/weekOffset";

const ARROW =
  "shrink-0 w-9 h-9 rounded-full grid place-items-center text-[15px] font-semibold transition-colors";

function Arrow({
  offset,
  disabled,
  label,
  glyph,
}: {
  offset: number;
  disabled: boolean;
  label: string;
  glyph: string;
}) {
  if (disabled) {
    return (
      <span aria-hidden className={`${ARROW} text-ink-faint/40 bg-cream/40 dark:bg-white/[0.02]`}>
        {glyph}
      </span>
    );
  }
  return (
    <Link
      href={offset === 0 ? "/mobile/meals" : `/mobile/meals?w=${offset}`}
      aria-label={label}
      className={`${ARROW} text-ink-soft bg-cream/70 dark:bg-white/[0.06] dark:text-cream/70 hover:bg-cream dark:hover:bg-white/[0.1]`}
    >
      {glyph}
    </Link>
  );
}

export function MealWeekNav({ offset }: { offset: number }) {
  const weekStart = weekStartWithOffset(offset);

  return (
    <div className="flex items-center gap-2 mb-3">
      <Arrow
        offset={offset - 1}
        disabled={offset <= MIN_WEEK_OFFSET}
        label="Vorherige Woche"
        glyph="‹"
      />

      <div className="flex-1 min-w-0 text-center">
        <div className="text-[14.5px] font-semibold text-ink dark:text-cream leading-tight">
          {weekOffsetLabel(offset)}
        </div>
        <div className="text-[11.5px] text-ink-faint">{formatWeekRange(weekStart)}</div>
      </div>

      <Arrow
        offset={offset + 1}
        disabled={offset >= MAX_WEEK_OFFSET}
        label="Nächste Woche"
        glyph="›"
      />
    </div>
  );
}
