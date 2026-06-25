import { describe, expect, it } from "vitest";

import { openMeteoFixture } from "./fixture";
import { conditionForCode, mapCurrent, mapForecast } from "./openMeteo";

describe("mapForecast", () => {
  const days = mapForecast(openMeteoFixture);

  it("returns one DayForecast per daily entry", () => {
    expect(days).toHaveLength(2);
    expect(days.map((d) => d.date)).toEqual(["2026-06-07", "2026-06-08"]);
  });

  it("groups contiguous rainy hours into rainWindows (two separate periods → two windows)", () => {
    const today = days[0];
    expect(today.rainWindows).toEqual([
      { from: "08:00", to: "10:00" },
      { from: "16:00", to: "19:00" },
    ]);
  });

  it("returns an empty rainWindows array for a dry day", () => {
    const dry = days[1];
    expect(dry.rainWindows).toEqual([]);
  });

  it("maps daily min/max temperatures, rounded", () => {
    expect(days[0]).toMatchObject({ minTemp: 10, maxTemp: 19 });
    expect(days[1]).toMatchObject({ minTemp: 10, maxTemp: 19 });
  });
});

describe("mapCurrent", () => {
  const current = mapCurrent(openMeteoFixture);

  it("reproduces the `weather` tile shape with mapped values", () => {
    expect(current).toEqual({
      temp: 18,
      label: "Regen",
      detail: "Regen ab 08:00 Uhr",
      hi: 19,
      lo: 10,
      rainFrom: "08:00",
      uvIndex: 4,
      wind: 12,
      condition: "rain",
    });
  });

  it("derives the condition from the current weather_code (61 → rain)", () => {
    expect(current.condition).toBe("rain");
  });

  it("derives a clear condition for a clear-sky code", () => {
    const clearFixture = {
      ...openMeteoFixture,
      current: { time: "2026-06-07T14:00", temperature_2m: 31, weather_code: 0, uv_index: 7 },
    };
    expect(mapCurrent(clearFixture).condition).toBe("clear");
  });

  it("derives rainFrom as the first rainy hour of today, formatted HH:MM", () => {
    expect(current.rainFrom).toBe("08:00");
  });

  it("falls back to the label as detail when there is no rain today", () => {
    const dryFixture = {
      ...openMeteoFixture,
      current: { time: "2026-06-08T12:00", temperature_2m: 17.8, weather_code: 2, uv_index: 1.1 },
    };
    const dryCurrent = mapCurrent(dryFixture);
    expect(dryCurrent.rainFrom).toBe("");
    expect(dryCurrent.detail).toBe(dryCurrent.label);
    expect(dryCurrent.label).toBe("Bewölkt");
    expect(dryCurrent.condition).toBe("cloudy");
  });

  it("maps the current UV index, rounded", () => {
    expect(mapCurrent(openMeteoFixture).uvIndex).toBe(4);
  });

  it("falls back to today's daily uv_index_max when current is absent", () => {
    const noCurrent = { ...openMeteoFixture, current: undefined };
    expect(mapCurrent(noCurrent).uvIndex).toBe(5);
  });

  it("mapCurrent liest die Windgeschwindigkeit aus current", () => {
    const result = mapCurrent(openMeteoFixture);
    expect(result.wind).toBe(12);
  });
});

describe("conditionForCode", () => {
  it("maps each WMO band to its icon condition", () => {
    expect(conditionForCode(0)).toBe("clear");
    expect(conditionForCode(1)).toBe("partly");
    expect(conditionForCode(2)).toBe("cloudy");
    expect(conditionForCode(3)).toBe("cloudy");
    expect(conditionForCode(45)).toBe("fog");
    expect(conditionForCode(48)).toBe("fog");
    expect(conditionForCode(61)).toBe("rain");
    expect(conditionForCode(80)).toBe("rain");
    expect(conditionForCode(71)).toBe("snow");
    expect(conditionForCode(95)).toBe("thunder");
  });

  it("falls back to cloudy for unknown codes", () => {
    expect(conditionForCode(999)).toBe("cloudy");
  });
});
