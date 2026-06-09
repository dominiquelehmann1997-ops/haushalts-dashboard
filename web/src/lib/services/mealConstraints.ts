// Reine Ableitung der dienstplan-bewussten Koch-Constraints je Wochentag.
//
// Eingabe: Domes Schicht-Klasse je lokalem Tag (via `shiftByDay`). Ausgabe:
// genau Mo–Fr der Woche, die `weekStart` enthält. Regeln (siehe Spec
// 2026-06-09): Spät an D → einfaches Gericht (Emely allein); Spät an D+1 oder
// Nacht an D → aufwärmbar + Extraportion. Pure (kein DB/Next/Prisma) — mirror
// des "reiner Mapper + Unit-Test"-Musters.

import type { ShiftClass } from "@/lib/calendar/shifts";
import { mondayOf } from "@/lib/dates";

export type MealReason = "emely-allein" | "aufwaermen-extra";

export interface DayConstraint {
  date: Date;
  needsSimple: boolean;
  needsReheatable: boolean;
  extraPortion: boolean;
  /** Anzeige-Verdichtung: priorisiert `emely-allein` über `aufwaermen-extra`. */
  reason: MealReason | null;
}

/** Returns a Date at `date + days`, local midnight preserved. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Leitet die Koch-Constraints für Mo–Fr der Woche um `weekStart` ab.
 * `shiftByDay(date)` liefert Domes Schicht-Klasse am lokalen Tag von `date`
 * (oder `null`). Für "Tag vor Spät" wird auch der Folgetag (bis Samstag)
 * abgefragt.
 */
export function deriveDayConstraints(
  weekStart: Date,
  shiftByDay: (date: Date) => ShiftClass | null,
): DayConstraint[] {
  const monday = mondayOf(weekStart);

  return [0, 1, 2, 3, 4].map((offset) => {
    const date = addDays(monday, offset);
    const today = shiftByDay(date);
    const tomorrow = shiftByDay(addDays(date, 1));

    const needsSimple = today === "spaet";
    const needsReheatable = tomorrow === "spaet" || today === "nacht";
    const extraPortion = needsReheatable;
    const reason: MealReason | null = needsSimple
      ? "emely-allein"
      : needsReheatable
        ? "aufwaermen-extra"
        : null;

    return { date, needsSimple, needsReheatable, extraPortion, reason };
  });
}
