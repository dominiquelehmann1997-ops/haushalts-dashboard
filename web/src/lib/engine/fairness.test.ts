import { describe, expect, it } from "vitest";

import { computeShare, selectByFairness } from "./fairness";
import type { Balances, PersonKey } from "./types";

describe("computeShare", () => {
  it("returns 0/0 when total balances are 0", () => {
    expect(computeShare({ dome: 0, emely: 0 })).toEqual({ dome: 0, emely: 0 });
  });

  it("returns each person's share of the total in percent", () => {
    expect(computeShare({ dome: 60, emely: 40 })).toEqual({ dome: 60, emely: 40 });
    expect(computeShare({ dome: 30, emely: 10 })).toEqual({ dome: 75, emely: 25 });
  });
});

describe("selectByFairness", () => {
  const persons: PersonKey[] = ["dome", "emely"];

  it("picks the candidate with the bigger target when actual shares are equal (both 0)", () => {
    const balances: Balances = { dome: 0, emely: 0 };
    expect(selectByFairness(persons, balances, { dome: 60, emely: 40 })).toBe("dome");
  });

  it("picks whoever is most behind their target share", () => {
    const balances: Balances = { dome: 65, emely: 35 };
    expect(selectByFairness(persons, balances, { dome: 60, emely: 40 })).toBe("emely");
  });

  it("picks emely when she is most behind a 50/50 target", () => {
    const balances: Balances = { dome: 30, emely: 10 };
    expect(selectByFairness(persons, balances, { dome: 50, emely: 50 })).toBe("emely");
  });

  it("returns the single candidate regardless of balances", () => {
    const balances: Balances = { dome: 0, emely: 100 };
    expect(selectByFairness(["dome"], balances, { dome: 60, emely: 40 })).toBe("dome");
  });

  it("biases away from a busy person via loadPenalty", () => {
    // Gleiche Ausgangslage (beide 0, 50/50) → ohne Penalty gewinnt dome (PERSON_ORDER).
    const balances: Balances = { dome: 0, emely: 0 };
    expect(selectByFairness(persons, balances, { dome: 50, emely: 50 })).toBe("dome");
    // Dome zu 90% belegt → sein Defizit wird stark gedämpft → emely gewinnt.
    expect(
      selectByFairness(persons, balances, { dome: 50, emely: 50 }, { dome: 0.9, emely: 0 }),
    ).toBe("emely");
  });

  it("ignores loadPenalty for a single candidate", () => {
    const balances: Balances = { dome: 0, emely: 100 };
    expect(selectByFairness(["dome"], balances, { dome: 50, emely: 50 }, { dome: 0.9, emely: 0 })).toBe("dome");
  });
});
