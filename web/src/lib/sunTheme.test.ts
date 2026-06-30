import { describe, expect, it } from "vitest";

import { isDarkBySun } from "./sunTheme";

const at = (h: number, m = 0) => new Date(2026, 5, 7, h, m);

describe("isDarkBySun", () => {
  const sunrise = "04:45";
  const sunset = "21:28";

  it("ist hell zwischen Sonnenauf- und -untergang", () => {
    expect(isDarkBySun(at(12), sunrise, sunset)).toBe(false);
    expect(isDarkBySun(at(4, 45), sunrise, sunset)).toBe(false); // exakt Aufgang = hell
    expect(isDarkBySun(at(21, 27), sunrise, sunset)).toBe(false);
  });

  it("ist dunkel vor Sonnenaufgang und ab Sonnenuntergang", () => {
    expect(isDarkBySun(at(3), sunrise, sunset)).toBe(true);
    expect(isDarkBySun(at(21, 28), sunrise, sunset)).toBe(true); // exakt Untergang = dunkel
    expect(isDarkBySun(at(23, 30), sunrise, sunset)).toBe(true);
  });

  it("bleibt hell bei fehlenden/ungültigen Sonnenzeiten (Wetter-Fallback)", () => {
    expect(isDarkBySun(at(3), "", "")).toBe(false);
    expect(isDarkBySun(at(23), "kaputt", "21:28")).toBe(false);
    expect(isDarkBySun(at(23), "04:45", "99:99")).toBe(false);
  });
});
