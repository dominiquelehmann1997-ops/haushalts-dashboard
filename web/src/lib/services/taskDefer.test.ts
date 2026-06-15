import { describe, it, expect } from "vitest";
import { nextSensibleDay } from "./taskDefer";

/**
 * Formats a Date as a local "YYYY-MM-DD" key — avoids off-by-one errors from
 * `.toISOString()` (UTC) when the local timezone is ahead of UTC (e.g. CEST).
 */
function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("nextSensibleDay", () => {
  it("nutzt den Rhythmus, wenn vorhanden (weekly = +7 Tage)", () => {
    const today = new Date("2026-06-14T00:00:00");
    const result = nextSensibleDay({ rhythm: "weekly" }, today);
    expect(dateKey(result)).toBe("2026-06-21");
  });
  it("fällt ohne Rhythmus auf morgen zurück", () => {
    const today = new Date("2026-06-14T00:00:00");
    const result = nextSensibleDay({ rhythm: null }, today);
    expect(dateKey(result)).toBe("2026-06-15");
  });
  it("mutiert `from` nicht", () => {
    const today = new Date("2026-06-14T00:00:00");
    const before = today.getTime();
    nextSensibleDay({ rhythm: "weekly" }, today);
    nextSensibleDay({ rhythm: null }, today);
    expect(today.getTime()).toBe(before);
  });
});
