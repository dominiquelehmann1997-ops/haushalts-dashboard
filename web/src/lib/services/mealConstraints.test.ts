import { describe, expect, it } from "vitest";

import type { ShiftClass } from "@/lib/calendar/shifts";

import { constraintFromEntry, deriveDayConstraints } from "./mealConstraints";

/** Builds a shiftByDay lookup from local-date → class for a Monday-based week. */
function lookupFrom(map: Record<string, ShiftClass>): (d: Date) => ShiftClass | null {
  return (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return map[key] ?? null;
  };
}

// Monday 2026-06-08 .. Saturday 2026-06-13 (month index 5 = June).
const MON = new Date(2026, 5, 8);

describe("deriveDayConstraints", () => {
  it("returns exactly Mon–Fri (5 entries) anchored to the week's Monday", () => {
    const result = deriveDayConstraints(MON, () => null);
    expect(result).toHaveLength(5);
    expect(result.map((c) => c.date.getDay())).toEqual([1, 2, 3, 4, 5]);
    expect(result.every((c) => c.reason === null && !c.extraPortion)).toBe(true);
  });

  it("Spätdienst-Tag → needsSimple + reason emely-allein", () => {
    const result = deriveDayConstraints(MON, lookupFrom({ "2026-6-10": "spaet" })); // Wed
    const wed = result[2];
    expect(wed.needsSimple).toBe(true);
    expect(wed.reason).toBe("emely-allein");
    expect(wed.needsReheatable).toBe(false);
  });

  it("Tag VOR Spätdienst → needsReheatable + extraPortion + reason aufwaermen-extra", () => {
    const result = deriveDayConstraints(MON, lookupFrom({ "2026-6-10": "spaet" })); // Wed
    const tue = result[1]; // Tag davor
    expect(tue.needsReheatable).toBe(true);
    expect(tue.extraPortion).toBe(true);
    expect(tue.reason).toBe("aufwaermen-extra");
    expect(tue.needsSimple).toBe(false);
  });

  it("Tag vor Spät am Freitag (Spät am Samstag, Lookahead) wird erkannt", () => {
    const result = deriveDayConstraints(MON, lookupFrom({ "2026-6-13": "spaet" })); // Sat
    const fri = result[4];
    expect(fri.needsReheatable).toBe(true);
    expect(fri.reason).toBe("aufwaermen-extra");
  });

  it("Nachtdienst-Tag → needsReheatable + extraPortion", () => {
    const result = deriveDayConstraints(MON, lookupFrom({ "2026-6-9": "nacht" })); // Tue
    const tue = result[1];
    expect(tue.needsReheatable).toBe(true);
    expect(tue.extraPortion).toBe(true);
    expect(tue.reason).toBe("aufwaermen-extra");
  });

  it("Konflikt (Spät an D und D+1): beide booleans gesetzt, reason priorisiert simple", () => {
    const result = deriveDayConstraints(
      MON,
      lookupFrom({ "2026-6-9": "spaet", "2026-6-10": "spaet" }), // Tue + Wed
    );
    const tue = result[1];
    expect(tue.needsSimple).toBe(true); // Spät an Tue
    expect(tue.needsReheatable).toBe(true); // Spät an Wed → Tue ist Tag-davor
    expect(tue.extraPortion).toBe(true);
    expect(tue.reason).toBe("emely-allein"); // Anzeige priorisiert simple
  });

  it("Früh und LT lösen keine Constraint aus", () => {
    const result = deriveDayConstraints(
      MON,
      lookupFrom({ "2026-6-8": "frueh", "2026-6-9": "lt" }),
    );
    expect(result[0].reason).toBeNull();
    expect(result[1].reason).toBeNull();
    expect(result[0].needsSimple).toBe(false);
    expect(result[0].needsReheatable).toBe(false);
    expect(result[1].needsSimple).toBe(false);
    expect(result[1].needsReheatable).toBe(false);
  });

  it("normalisiert einen beliebigen Wochentag auf den Montag der Woche", () => {
    const thursday = new Date(2026, 5, 11); // gleiche Woche wie MON
    const result = deriveDayConstraints(thursday, () => null);
    expect(result[0].date.getDate()).toBe(8); // Montag
  });
});

describe("constraintFromEntry", () => {
  it("reconstructs needsSimple/needsReheatable losslessly from a stored entry", () => {
    expect(constraintFromEntry("emely-allein", false)).toEqual({
      needsSimple: true,
      needsReheatable: false,
    });
    expect(constraintFromEntry("aufwaermen-extra", true)).toEqual({
      needsSimple: false,
      needsReheatable: true,
    });
    // Konflikt-Tag: reason emely-allein + extraPortion true → beide true
    expect(constraintFromEntry("emely-allein", true)).toEqual({
      needsSimple: true,
      needsReheatable: true,
    });
    // Kein Constraint
    expect(constraintFromEntry(null, false)).toEqual({
      needsSimple: false,
      needsReheatable: false,
    });
  });
});
