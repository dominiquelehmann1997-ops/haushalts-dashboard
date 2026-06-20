import { describe, expect, it } from "vitest";

import { planTask } from "./index";
import type { BusyWindow, DayForecast, EngineTask, PhaseConfig, PlanInput } from "./types";

const PHASE: PhaseConfig = { mode: "normal", target: { dome: 60, emely: 40 } };

function day(d: number): Date {
  return new Date(2026, 5, d);
}

function baseInput(overrides: Partial<PlanInput>): PlanInput {
  return {
    task: { id: "t1", allowedPersons: "both", outdoor: false, effort: 1 },
    day: day(10),
    persons: ["dome", "emely"],
    busy: [],
    forecast: [],
    phase: PHASE,
    balances: { dome: 0, emely: 0 },
    ...overrides,
  };
}

describe("planTask", () => {
  it("'Rasen mähen': defers to the next rain-free day when it rains", () => {
    const task: EngineTask = {
      id: "rasen",
      allowedPersons: "dome",
      outdoor: true,
      weatherCondition: { noRain: true },
      effort: 2,
    };
    const forecast: DayForecast[] = [
      { date: "2026-06-10", rainWindows: [{ from: "10:00", to: "12:00" }], minTemp: 10, maxTemp: 20 },
      { date: "2026-06-11", rainWindows: [{ from: "08:00", to: "09:00" }], minTemp: 10, maxTemp: 20 },
      { date: "2026-06-12", rainWindows: [], minTemp: 10, maxTemp: 20 },
    ];
    const result = planTask(baseInput({ task, forecast }));
    expect(result).toEqual({ kind: "deferred", reason: "Regen", suggestedDay: day(12) });
  });

  it("assigns an indoor 'both' task to dome when he's most behind his target share", () => {
    const task: EngineTask = { id: "t2", allowedPersons: "both", outdoor: false, effort: 1 };
    const result = planTask(baseInput({ task, balances: { dome: 0, emely: 0 } }));
    expect(result).toEqual({ kind: "assigned", person: "dome", day: day(10) });
  });

  it("assigns an indoor 'both' task to emely when she's most behind her target share", () => {
    const task: EngineTask = { id: "t3", allowedPersons: "both", outdoor: false, effort: 1 };
    const result = planTask(baseInput({ task, balances: { dome: 65, emely: 35 } }));
    expect(result).toEqual({ kind: "assigned", person: "emely", day: day(10) });
  });

  it("returns unassignable 'niemand verfügbar' when both candidates are busy in the window", () => {
    const task: EngineTask = { id: "t4", allowedPersons: "both", outdoor: false, effort: 1 };
    const window = { start: new Date(2026, 5, 10, 9, 0), end: new Date(2026, 5, 10, 11, 0) };
    const busy: BusyWindow[] = [
      { person: "dome", start: new Date(2026, 5, 10, 9, 30), end: new Date(2026, 5, 10, 10, 30) },
      { person: "emely", start: new Date(2026, 5, 10, 10, 0), end: new Date(2026, 5, 10, 12, 0) },
    ];
    const result = planTask(baseInput({ task, window, busy }));
    expect(result).toEqual({ kind: "unassignable", reason: "niemand verfügbar" });
  });

  it("assigns to emely when allowedPersons is 'emely'", () => {
    const task: EngineTask = { id: "t5", allowedPersons: "emely", outdoor: false, effort: 1 };
    const result = planTask(baseInput({ task, balances: { dome: 0, emely: 0 } }));
    expect(result).toEqual({ kind: "assigned", person: "emely", day: day(10) });
  });

  it("returns unassignable 'niemand erlaubt' when no candidate remains after person filtering", () => {
    const task: EngineTask = { id: "t6", allowedPersons: "dome", outdoor: false, effort: 1 };
    const result = planTask(baseInput({ task, persons: ["emely"] }));
    expect(result).toEqual({ kind: "unassignable", reason: "niemand erlaubt" });
  });
});

describe("planTask — Tageskapazität", () => {
  const task: EngineTask = { id: "cap", allowedPersons: "both", outdoor: false, effort: 1 };

  it("excludes a person whose day is fully booked (load ≥ 0.8) and assigns the other", () => {
    // Ohne Kapazität gewänne dome (60/40, beide 0). Dome zu 90% belegt → emely.
    const result = planTask(baseInput({ task, dayLoad: { dome: 0.9, emely: 0.1 } }));
    expect(result).toEqual({ kind: "assigned", person: "emely", day: day(10) });
  });

  it("returns unassignable when everyone left is fully booked", () => {
    const result = planTask(baseInput({ task, dayLoad: { dome: 0.85, emely: 0.95 } }));
    expect(result).toEqual({ kind: "unassignable", reason: "ganztägig belegt" });
  });

  it("applies a soft bias for partial load without hard-excluding", () => {
    // 50/50, beide 0 → ohne Last gewänne dome. Dome 60% belegt (<0.8) → Bias → emely.
    const result = planTask(
      baseInput({ task, phase: { mode: "normal", target: { dome: 50, emely: 50 } }, dayLoad: { dome: 0.6, emely: 0 } }),
    );
    expect(result).toEqual({ kind: "assigned", person: "emely", day: day(10) });
  });
});
