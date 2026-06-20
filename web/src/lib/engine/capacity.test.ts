import { describe, expect, it } from "vitest";

import { activeDayWindow, dayLoad } from "./capacity";
import type { BusyWindow } from "./types";

const W = activeDayWindow(new Date(2026, 5, 10)); // 08:00–22:00, 14h

function at(h: number, m = 0): Date {
  return new Date(2026, 5, 10, h, m);
}

describe("activeDayWindow", () => {
  it("spans local 08:00–22:00 of the given day", () => {
    expect(W.start.getHours()).toBe(8);
    expect(W.end.getHours()).toBe(22);
  });
});

describe("dayLoad", () => {
  it("returns 0 for both when nobody is busy", () => {
    expect(dayLoad([], W)).toEqual({ dome: 0, emely: 0 });
  });

  it("computes the covered fraction of the active day per person", () => {
    const busy: BusyWindow[] = [{ person: "dome", start: at(8), end: at(15) }]; // 7h / 14h = 0.5
    const load = dayLoad(busy, W);
    expect(load.dome).toBeCloseTo(0.5, 5);
    expect(load.emely).toBe(0);
  });

  it("clips busy windows to the active day (early/late edges don't over-count)", () => {
    const busy: BusyWindow[] = [{ person: "emely", start: at(6), end: at(9) }]; // nur 08–09 zählt = 1h/14h
    expect(dayLoad(busy, W).emely).toBeCloseTo(1 / 14, 5);
  });

  it("merges overlapping windows instead of double-counting", () => {
    const busy: BusyWindow[] = [
      { person: "dome", start: at(8), end: at(12) },
      { person: "dome", start: at(10), end: at(15) }, // Überlappung 10–12
    ]; // Union 08–15 = 7h / 14h
    expect(dayLoad(busy, W).dome).toBeCloseTo(0.5, 5);
  });

  it("caps a full/overnight coverage at 1", () => {
    const busy: BusyWindow[] = [{ person: "dome", start: at(0), end: at(14) }]; // Nacht→14:00: 08–14 = 6h
    expect(dayLoad(busy, W).dome).toBeCloseTo(6 / 14, 5);
    const all: BusyWindow[] = [{ person: "emely", start: at(7), end: at(23) }];
    expect(dayLoad(all, W).emely).toBe(1);
  });
});
