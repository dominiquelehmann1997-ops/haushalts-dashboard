// Reine Ableitung der dienstplan-bewussten Koch-Constraints je Wochentag.
//
// Eingabe: Domes Schicht-Klasse je lokalem Tag (via `shiftByDay`). Ausgabe:
// genau Mo–So der Woche, die `weekStart` enthält. Regeln (siehe Spec
// 2026-06-09): Spät an D → einfaches Gericht (Emely allein); Spät an D+1 oder
// Nacht an D → aufwärmbar + Extraportion. Pure (kein DB/Next/Prisma) — mirror
// des "reiner Mapper + Unit-Test"-Musters.

import type { ShiftClass } from "@/lib/calendar/shifts";
import { addDays, mondayOf } from "@/lib/dates";

export type MealReason = "emely-allein" | "aufwaermen-extra";

export interface DayConstraint {
  date: Date;
  needsSimple: boolean;
  needsReheatable: boolean;
  extraPortion: boolean;
  /** Anzeige-Verdichtung: priorisiert `emely-allein` über `aufwaermen-extra`. */
  reason: MealReason | null;
}

/**
 * Leitet die Koch-Constraints für Mo–So der Woche um `weekStart` ab.
 * `shiftByDay(date)` liefert Domes Schicht-Klasse am lokalen Tag von `date`
 * (oder `null`). Für "Tag vor Spät" wird auch der Folgetag (für Sonntag der
 * Montag der Folgewoche) abgefragt.
 */
export function deriveDayConstraints(
  weekStart: Date,
  shiftByDay: (date: Date) => ShiftClass | null,
): DayConstraint[] {
  const monday = mondayOf(weekStart);

  return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
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

/**
 * Rekonstruiert `{ needsSimple, needsReheatable }` verlustfrei aus einem
 * gespeicherten Eintrag. Gilt, weil `deriveDayConstraints` immer
 * `extraPortion === needsReheatable` setzt und `reason === "emely-allein"`
 * genau `needsSimple` markiert. Wird vom Re-Roll eines Entwurfs-Tages genutzt.
 */
export function constraintFromEntry(
  reason: string | null,
  extraPortion: boolean,
): { needsSimple: boolean; needsReheatable: boolean } {
  return {
    needsSimple: reason === "emely-allein",
    needsReheatable: extraPortion,
  };
}
