import { describe, expect, it } from "vitest";

import { MAX_WEEK_OFFSET, MIN_WEEK_OFFSET, clampWeekOffset } from "./weekOffset";

describe("clampWeekOffset", () => {
  it("lässt Offsets innerhalb der Spanne durch", () => {
    for (let o = MIN_WEEK_OFFSET; o <= MAX_WEEK_OFFSET; o++) {
      expect(clampWeekOffset(o)).toBe(o);
    }
  });

  it("klemmt Offsets außerhalb der Spanne an die Ränder", () => {
    expect(clampWeekOffset(99)).toBe(MAX_WEEK_OFFSET);
    expect(clampWeekOffset(-99)).toBe(MIN_WEEK_OFFSET);
  });

  it("fällt bei unparsbaren URL-Werten auf die laufende Woche zurück", () => {
    // `Number("abc")` → NaN; ohne Abfangen entstünde ein Invalid Date.
    expect(clampWeekOffset(Number("abc"))).toBe(0);
    expect(clampWeekOffset(Infinity)).toBe(0);
  });

  it("schneidet Nachkommastellen ab, statt zu runden", () => {
    expect(clampWeekOffset(1.9)).toBe(1);
    expect(clampWeekOffset(-0.9)).toBe(0);
  });

  it("erlaubt mindestens die nächste Woche — das ist der Zweck der Vorausplanung", () => {
    expect(MAX_WEEK_OFFSET).toBeGreaterThanOrEqual(1);
  });
});
