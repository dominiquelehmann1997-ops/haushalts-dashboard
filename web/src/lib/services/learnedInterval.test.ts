import { describe, expect, it } from "vitest";
import { learnedInterval } from "./learnedInterval";

const WEEKLY = 7;

describe("learnedInterval", () => {
  it("returns null below the minimum observation count (N<3 intervals)", () => {
    expect(learnedInterval([], WEEKLY)).toBeNull();
    expect(learnedInterval([7], WEEKLY)).toBeNull();
    expect(learnedInterval([7, 7], WEEKLY)).toBeNull();
  });

  it("returns the steady interval when completions are evenly spaced", () => {
    expect(learnedInterval([7, 7, 7], WEEKLY)).toBeCloseTo(7, 5);
  });

  it("pulls the interval DOWN when recent completions get closer together (done early)", () => {
    // weekly routine, last gaps shrinking
    const learned = learnedInterval([7, 5, 3], WEEKLY);
    expect(learned).not.toBeNull();
    expect(learned!).toBeLessThan(7);
  });

  it("pushes the interval UP when recent gaps grow (kept being deferred)", () => {
    const learned = learnedInterval([7, 9, 12], WEEKLY);
    expect(learned!).toBeGreaterThan(7);
  });

  it("weights the most recent gap most (EWMA alpha=0.25)", () => {
    // ewma seeded at first, folded: 10 -> 0.25*10+0.75*10=10 -> 0.25*4+0.75*10=8.5
    expect(learnedInterval([10, 10, 4], WEEKLY)).toBeCloseTo(8.5, 5);
  });

  describe("Deckel (MAX_STRETCH = 2x)", () => {
    it("never stretches beyond twice the configured rhythm", () => {
      // Alle Abstände am oberen Rand des Erlaubten (3x7=21 wäre Ausreißer)
      const learned = learnedInterval([20, 20, 20], WEEKLY);
      expect(learned).toBe(2 * WEEKLY);
    });

    it("caps a daily rhythm at 2 days no matter how sloppy the history is", () => {
      expect(learnedInterval([2.9, 2.9, 2.9], 1)).toBe(2);
    });

    it("does not cap shortening — more frequent completions stay honored", () => {
      const learned = learnedInterval([2, 2, 2], WEEKLY);
      expect(learned).toBeCloseTo(2, 5);
    });
  });

  describe("Urlaubslücken (OUTLIER_FACTOR = 3x)", () => {
    it("ignores a single absence gap instead of letting it drag the average up", () => {
      const withoutAbsence = learnedInterval([7, 7, 7], WEEKLY);
      const withAbsence = learnedInterval([7, 7, 7, 30], WEEKLY);
      expect(withAbsence).toBeCloseTo(withoutAbsence!, 5);
    });

    it("keeps gaps up to 3x — a genuinely slower cadence is still learned", () => {
      // 21 = exactly 3x weekly -> still an observation, not an absence
      const learned = learnedInterval([21, 21, 21], WEEKLY);
      expect(learned).toBe(2 * WEEKLY); // gelernt 21, aber gedeckelt auf 14
    });

    it("returns null when too few gaps survive the outlier filter", () => {
      // nur 2 verwertbare Abstände, der Rest ist Abwesenheit
      expect(learnedInterval([7, 7, 40, 50], WEEKLY)).toBeNull();
    });
  });

  it("returns null for a non-positive configured interval", () => {
    expect(learnedInterval([1, 1, 1], 0)).toBeNull();
    expect(learnedInterval([1, 1, 1], -3)).toBeNull();
  });
});
