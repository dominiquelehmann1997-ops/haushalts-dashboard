import { describe, expect, it } from "vitest";

import { filterByAvailability } from "./availability";
import type { BusyWindow, PersonKey } from "./types";

const persons: PersonKey[] = ["dome", "emely"];

function win(startHour: number, endHour: number) {
  return {
    start: new Date(2026, 5, 10, startHour, 0),
    end: new Date(2026, 5, 10, endHour, 0),
  };
}

describe("filterByAvailability", () => {
  it("returns all persons unchanged when no window is given", () => {
    const busy: BusyWindow[] = [
      { person: "dome", start: new Date(2026, 5, 10, 9), end: new Date(2026, 5, 10, 10) },
    ];
    expect(filterByAvailability(persons, undefined, busy)).toEqual(["dome", "emely"]);
  });

  it("excludes a person whose busy window overlaps the task window", () => {
    const window = win(9, 11);
    const busy: BusyWindow[] = [
      { person: "dome", start: new Date(2026, 5, 10, 10), end: new Date(2026, 5, 10, 12) },
    ];
    expect(filterByAvailability(persons, window, busy)).toEqual(["emely"]);
  });

  it("includes a person whose busy window does not overlap the task window", () => {
    const window = win(9, 11);
    const busy: BusyWindow[] = [
      { person: "dome", start: new Date(2026, 5, 10, 11), end: new Date(2026, 5, 10, 12) },
    ];
    expect(filterByAvailability(persons, window, busy)).toEqual(["dome", "emely"]);
  });

  it("includes Emely when she has no busy window", () => {
    const window = win(9, 11);
    const busy: BusyWindow[] = [
      { person: "dome", start: new Date(2026, 5, 10, 9), end: new Date(2026, 5, 10, 10) },
    ];
    expect(filterByAvailability(persons, window, busy)).toEqual(["emely"]);
  });
});
