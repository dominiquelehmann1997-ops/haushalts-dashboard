import { describe, expect, it } from "vitest";

import { checkWeather } from "./weatherCheck";
import type { DayForecast, EngineTask } from "./types";

const BASE: EngineTask = { id: "t1", allowedPersons: "both", outdoor: true, effort: 1 };

function day(d: number): Date {
  return new Date(2026, 5, d); // June 2026, local time
}

describe("checkWeather", () => {
  it("is always ok for non-outdoor tasks", () => {
    const task: EngineTask = { ...BASE, outdoor: false, weatherCondition: { noRain: true } };
    expect(checkWeather(task, day(10), [])).toEqual({ ok: true });
  });

  it("is ok when there's no forecast entry for the day at all (no data = don't block)", () => {
    const task: EngineTask = { ...BASE, weatherCondition: { noRain: true } };
    expect(checkWeather(task, day(10), [])).toEqual({ ok: true });
  });

  it("is ok for outdoor + noRain when the day has no rain", () => {
    const task: EngineTask = { ...BASE, weatherCondition: { noRain: true } };
    const forecast: DayForecast[] = [
      { date: "2026-06-10", rainWindows: [], minTemp: 10, maxTemp: 20 },
    ];
    expect(checkWeather(task, day(10), forecast)).toEqual({ ok: true });
  });

  it("defers to the next rain-free day when it rains and no window is given", () => {
    const task: EngineTask = { ...BASE, weatherCondition: { noRain: true } };
    const forecast: DayForecast[] = [
      { date: "2026-06-10", rainWindows: [{ from: "10:00", to: "12:00" }], minTemp: 10, maxTemp: 20 },
      { date: "2026-06-11", rainWindows: [{ from: "08:00", to: "09:00" }], minTemp: 10, maxTemp: 20 },
      { date: "2026-06-12", rainWindows: [], minTemp: 10, maxTemp: 20 },
    ];
    expect(checkWeather(task, day(10), forecast)).toEqual({
      ok: false,
      suggestedDay: day(12),
      reason: "Regen",
    });
  });

  it("falls back to day+1 as suggestedDay when no later forecast day is rain-free", () => {
    const task: EngineTask = { ...BASE, weatherCondition: { noRain: true } };
    const forecast: DayForecast[] = [
      { date: "2026-06-10", rainWindows: [{ from: "10:00", to: "12:00" }], minTemp: 10, maxTemp: 20 },
      { date: "2026-06-11", rainWindows: [{ from: "08:00", to: "09:00" }], minTemp: 10, maxTemp: 20 },
    ];
    expect(checkWeather(task, day(10), forecast)).toEqual({
      ok: false,
      suggestedDay: day(11),
      reason: "Regen",
    });
  });

  it("is ok when a given window does not overlap a rain window", () => {
    const task: EngineTask = { ...BASE, weatherCondition: { noRain: true } };
    const forecast: DayForecast[] = [
      { date: "2026-06-10", rainWindows: [{ from: "16:00", to: "18:00" }], minTemp: 10, maxTemp: 20 },
    ];
    const window = { start: new Date(2026, 5, 10, 9, 0), end: new Date(2026, 5, 10, 11, 0) };
    expect(checkWeather(task, day(10), forecast, window)).toEqual({ ok: true });
  });

  it("is not ok when a given window overlaps a rain window", () => {
    const task: EngineTask = { ...BASE, weatherCondition: { noRain: true } };
    const forecast: DayForecast[] = [
      { date: "2026-06-10", rainWindows: [{ from: "10:00", to: "12:00" }], minTemp: 10, maxTemp: 20 },
      { date: "2026-06-11", rainWindows: [], minTemp: 10, maxTemp: 20 },
    ];
    const window = { start: new Date(2026, 5, 10, 9, 0), end: new Date(2026, 5, 10, 11, 0) };
    expect(checkWeather(task, day(10), forecast, window)).toEqual({
      ok: false,
      suggestedDay: day(11),
      reason: "Regen",
    });
  });

  it("is not ok with reason 'zu kalt' when the day doesn't reach minTemp", () => {
    const task: EngineTask = { ...BASE, weatherCondition: { noRain: false, minTemp: 15 } };
    const forecast: DayForecast[] = [
      { date: "2026-06-10", rainWindows: [], minTemp: 5, maxTemp: 12 },
      { date: "2026-06-11", rainWindows: [], minTemp: 8, maxTemp: 18 },
    ];
    expect(checkWeather(task, day(10), forecast)).toEqual({
      ok: false,
      suggestedDay: day(11),
      reason: "zu kalt",
    });
  });
});
