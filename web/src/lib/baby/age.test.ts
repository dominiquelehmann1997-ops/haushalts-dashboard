import { describe, expect, it } from "vitest";

import { babyAge } from "./age";

describe("babyAge", () => {
  it("Kaya (born 2026-03-10) on 2026-06-08 is ~12 weeks, band 0-3m", () => {
    const a = babyAge(new Date(2026, 2, 10), new Date(2026, 5, 8));
    expect(a.ageBand).toBe("0-3m");
    expect(a.label).toBe("12 Wochen");
  });

  it("shows weeks while under 4 months", () => {
    expect(babyAge(new Date(2026, 2, 10), new Date(2026, 4, 1)).label).toMatch(/Wochen|Woche/);
  });

  it("switches to 4m+ and months once 4 completed months are reached", () => {
    const a = babyAge(new Date(2026, 2, 10), new Date(2026, 6, 10));
    expect(a.ageBand).toBe("4m+");
    expect(a.label).toBe("4 Monate");
  });

  it("stays 0-3m the day before completing 4 months", () => {
    expect(babyAge(new Date(2026, 2, 10), new Date(2026, 6, 9)).ageBand).toBe("0-3m");
  });

  it("uses the singular form for exactly one week", () => {
    expect(babyAge(new Date(2026, 2, 10), new Date(2026, 2, 17)).label).toBe("1 Woche");
  });

  it("is 0 Wochen on the day of birth", () => {
    const a = babyAge(new Date(2026, 2, 10), new Date(2026, 2, 10));
    expect(a.ageBand).toBe("0-3m");
    expect(a.label).toBe("0 Wochen");
  });
});
