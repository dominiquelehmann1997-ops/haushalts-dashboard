import { describe, expect, it } from "vitest";

import { recommendClothing } from "./clothing";

describe("recommendClothing", () => {
  it("hot day (28°, allgemein, 0-3m): light layers with a sun hat, warmth 'heiß'", () => {
    const advice = recommendClothing({ tempC: 28, situation: "allgemein", ageBand: "0-3m" });
    expect(advice.warmth).toBe("heiß");
    expect(advice.layers).toContain("Sonnenhut");
    expect(advice.layers).toContain("Langarmbody");
  });

  it("mild day (20°, allgemein, 0-3m): matches the calibrated baby-wetter.de layers", () => {
    const advice = recommendClothing({ tempC: 20, situation: "allgemein", ageBand: "0-3m" });
    expect(advice.warmth).toBe("mild");
    expect(advice.layers).toEqual(
      expect.arrayContaining(["Langarmbody", "Hose", "dünner Pullover", "dünne Mütze"]),
    );
  });

  it("formats the temperature band as a human range", () => {
    expect(recommendClothing({ tempC: 15, situation: "allgemein", ageBand: "0-3m" }).tempBand).toBe(
      "13–17 °C",
    );
  });

  it("cool day (15°, kinderwagen): several layers + a Fußsack hint", () => {
    const advice = recommendClothing({ tempC: 15, situation: "kinderwagen", ageBand: "0-3m" });
    expect(advice.warmth).toBe("kühl");
    expect(advice.layers.length).toBeGreaterThanOrEqual(5);
    expect(advice.hint).toMatch(/Fußsack/);
  });

  it("frost (1°, auto): warm layers WITHOUT a thick jacket + a blanket/belt hint", () => {
    const advice = recommendClothing({ tempC: 1, situation: "auto", ageBand: "0-3m" });
    expect(advice.warmth).toBe("frost");
    expect(advice.layers.some((l) => /Jacke|Overall/.test(l))).toBe(false);
    expect(advice.hint).toMatch(/Decke|Gurt/);
  });

  it("sleeping (20°, schlafen): a sleeping bag instead of outdoor layers, no loose blankets hint", () => {
    const advice = recommendClothing({ tempC: 20, situation: "schlafen", ageBand: "0-3m" });
    expect(advice.layers).toContain("Schlafsack");
    expect(advice.layers.some((l) => /Jacke|Mütze|Sonnenhut/.test(l))).toBe(false);
    expect(advice.hint).toMatch(/Schlafsack|Decke/);
  });

  it("at home (18°, zuhause): no outdoor pieces (jacket/hat)", () => {
    const advice = recommendClothing({ tempC: 18, situation: "zuhause", ageBand: "0-3m" });
    expect(advice.layers.some((l) => /Jacke|Sonnenhut|Mütze/.test(l))).toBe(false);
  });

  it("babytrage: one layer fewer than allgemein at the same temperature", () => {
    const trage = recommendClothing({ tempC: 10, situation: "babytrage", ageBand: "0-3m" });
    const allgemein = recommendClothing({ tempC: 10, situation: "allgemein", ageBand: "0-3m" });
    expect(trage.layers.length).toBeLessThan(allgemein.layers.length);
    expect(trage.hint).toMatch(/Trage|Körperwärme/);
  });

  it("0-3m gets at least as many layers as 4m+ at the same temperature", () => {
    const young = recommendClothing({ tempC: 16, situation: "allgemein", ageBand: "0-3m" });
    const older = recommendClothing({ tempC: 16, situation: "allgemein", ageBand: "4m+" });
    expect(young.layers.length).toBeGreaterThanOrEqual(older.layers.length);
  });

  it("always starts with a Windel and a body", () => {
    const advice = recommendClothing({ tempC: 22, situation: "allgemein", ageBand: "0-3m" });
    expect(advice.layers[0]).toBe("Windel");
    expect(advice.layers.some((l) => /body/i.test(l))).toBe(true);
  });
});
