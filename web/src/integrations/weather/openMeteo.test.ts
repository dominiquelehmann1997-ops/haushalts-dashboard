import { describe, expect, it } from "vitest";

import { openMeteoFixture } from "./fixture";
import { mapCurrent, mapForecast } from "./openMeteo";

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
    });
  });

  it("derives rainFrom as the first rainy hour of today, formatted HH:MM", () => {
    expect(current.rainFrom).toBe("08:00");
  });

  it("falls back to the label as detail when there is no rain today", () => {
    const dryFixture = {
      ...openMeteoFixture,
      current: { time: "2026-06-08T12:00", temperature_2m: 17.8, weather_code: 2 },
    };
    const dryCurrent = mapCurrent(dryFixture);
    expect(dryCurrent.rainFrom).toBe("");
    expect(dryCurrent.detail).toBe(dryCurrent.label);
    expect(dryCurrent.label).toBe("Bewölkt");
  });
});
