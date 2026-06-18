import { describe, expect, it } from "vitest";
import { learnedInterval } from "./learnedInterval";

describe("learnedInterval", () => {
  it("returns null below the minimum observation count (N<3 intervals)", () => {
    expect(learnedInterval([])).toBeNull();
    expect(learnedInterval([7])).toBeNull();
    expect(learnedInterval([7, 7])).toBeNull();
  });

  it("returns the steady interval when completions are evenly spaced", () => {
    expect(learnedInterval([7, 7, 7])).toBeCloseTo(7, 5);
  });

  it("pulls the interval DOWN when recent completions get closer together (done early)", () => {
    // weekly routine, last gaps shrinking
    const learned = learnedInterval([7, 5, 3]);
    expect(learned).not.toBeNull();
    expect(learned!).toBeLessThan(7);
  });

  it("pushes the interval UP when recent gaps grow (kept being deferred)", () => {
    const learned = learnedInterval([7, 9, 12]);
    expect(learned!).toBeGreaterThan(7);
  });

  it("weights the most recent gap most (EWMA alpha=0.25)", () => {
    // ewma seeded at first, folded: 10 -> 0.25*10+0.75*10=10 -> 0.25*4+0.75*10=8.5
    expect(learnedInterval([10, 10, 4])).toBeCloseTo(8.5, 5);
  });
});
