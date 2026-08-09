import { describe, expect, it } from "vitest";

import {
  CUSTOM_RHYTHM_MAX_DAYS,
  RHYTHM_OPTIONS,
  isValidRhythm,
  makeCustomRhythm,
  parseCustomRhythm,
  rhythmLabel,
} from "./rhythm";

describe("parseCustomRhythm", () => {
  it("liest die Tagesanzahl aus einem freien Rhythmus", () => {
    expect(parseCustomRhythm("10-day")).toBe(10);
    expect(parseCustomRhythm("1-day")).toBe(1);
    expect(parseCustomRhythm(`${CUSTOM_RHYTHM_MAX_DAYS}-day`)).toBe(CUSTOM_RHYTHM_MAX_DAYS);
  });

  it("liest auch die Presets, die dasselbe Format haben", () => {
    expect(parseCustomRhythm("3-day")).toBe(3);
    expect(parseCustomRhythm("5-day")).toBe(5);
  });

  it("weist Werte außerhalb von 1…365 ab", () => {
    expect(parseCustomRhythm("0-day")).toBeNull();
    expect(parseCustomRhythm("366-day")).toBeNull();
  });

  it("weist alles ab, was nicht dem Muster entspricht", () => {
    expect(parseCustomRhythm("weekly")).toBeNull();
    expect(parseCustomRhythm("2x-week")).toBeNull();
    expect(parseCustomRhythm("-day")).toBeNull();
    expect(parseCustomRhythm("x-day")).toBeNull();
    expect(parseCustomRhythm("10-days")).toBeNull();
    expect(parseCustomRhythm("1000-day")).toBeNull();
    expect(parseCustomRhythm("")).toBeNull();
  });
});

describe("makeCustomRhythm", () => {
  it("erzeugt einen Wert, den parseCustomRhythm wieder liest", () => {
    expect(makeCustomRhythm(10)).toBe("10-day");
    expect(parseCustomRhythm(makeCustomRhythm(42))).toBe(42);
  });
});

describe("isValidRhythm", () => {
  it("akzeptiert jedes Preset", () => {
    for (const { value } of RHYTHM_OPTIONS) {
      expect(isValidRhythm(value)).toBe(true);
    }
  });

  it("akzeptiert freie Intervalle im erlaubten Bereich", () => {
    expect(isValidRhythm("10-day")).toBe(true);
    expect(isValidRhythm("365-day")).toBe(true);
  });

  it("lehnt Unsinn und Werte außerhalb des Bereichs ab", () => {
    expect(isValidRhythm("400-day")).toBe(false);
    expect(isValidRhythm("0-day")).toBe(false);
    expect(isValidRhythm("gelegentlich")).toBe(false);
    expect(isValidRhythm("")).toBe(false);
  });
});

describe("rhythmLabel", () => {
  it("nimmt für Presets das Preset-Label", () => {
    expect(rhythmLabel("daily")).toBe("Täglich");
    expect(rhythmLabel("2x-week")).toBe("2× pro Woche");
    expect(rhythmLabel("3-day")).toBe("Alle 3 Tage");
    expect(rhythmLabel("halfyearly")).toBe("Halbjährlich");
  });

  it("beschriftet freie Intervalle", () => {
    expect(rhythmLabel("10-day")).toBe("Alle 10 Tage");
  });

  it("nennt ein Ein-Tages-Intervall täglich, nicht 'Alle 1 Tage'", () => {
    expect(rhythmLabel("1-day")).toBe("Täglich");
  });

  it("benennt einen fehlenden Rhythmus, statt ihn zu verschweigen", () => {
    expect(rhythmLabel(null)).toBe("Kein Rhythmus");
    expect(rhythmLabel("")).toBe("Kein Rhythmus");
  });

  it("gibt unbekannte Werte unverändert zurück, statt sie zu erfinden", () => {
    expect(rhythmLabel("400-day")).toBe("400-day");
  });
});
