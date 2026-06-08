// Pure baby-age helper: birthdate + reference date → age band (for the
// clothing/UV logic) and a human label ("12 Wochen" / "5 Monate"). No I/O.

import type { AgeBand } from "./types";

/** Completed whole months between `birth` and `now`. */
function completedMonths(birth: Date, now: Date): number {
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return months;
}

export interface BabyAge {
  ageBand: AgeBand;
  label: string; // weeks while in the 0-3m band, months from 4m+
}

/**
 * Derives the baby's age band and a display label from the birthdate.
 * Mirrors baby-wetter.de's "weeks first, then months" convention: weeks are
 * shown while under 4 completed months ("0-3m"), months from then on ("4m+").
 */
export function babyAge(birth: Date, now: Date): BabyAge {
  const months = completedMonths(birth, now);
  const ageBand: AgeBand = months >= 4 ? "4m+" : "0-3m";

  let label: string;
  if (ageBand === "0-3m") {
    const days = Math.floor((now.getTime() - birth.getTime()) / 86_400_000);
    const weeks = Math.floor(days / 7);
    label = `${weeks} ${weeks === 1 ? "Woche" : "Wochen"}`;
  } else {
    label = `${months} ${months === 1 ? "Monat" : "Monate"}`;
  }

  return { ageBand, label };
}
