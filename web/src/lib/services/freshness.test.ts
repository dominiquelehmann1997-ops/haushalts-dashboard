import { describe, expect, it } from "vitest";

import {
  classifyFreshness,
  normalizeIngredientName,
  resolveFreshness,
  suggestFreshShoppingDay,
  type Freshness,
} from "./freshness";

describe("classifyFreshness", () => {
  it("classifies known fresh keywords as frisch (case-insensitive, substring)", () => {
    expect(classifyFreshness("Salat")).toBe("frisch");
    expect(classifyFreshness("Milch")).toBe("frisch");
    expect(classifyFreshness("Hackfleisch")).toBe("frisch"); // substring "hack"/"fleisch"
    expect(classifyFreshness("Basilikum")).toBe("frisch");
    expect(classifyFreshness("tomaten")).toBe("frisch");
    expect(classifyFreshness("Zucchini")).toBe("frisch");
  });

  it("defaults to haltbar for everything else", () => {
    expect(classifyFreshness("Nudeln")).toBe("haltbar");
    expect(classifyFreshness("Reis")).toBe("haltbar");
    expect(classifyFreshness("Mehl")).toBe("haltbar");
    expect(classifyFreshness("Olivenöl")).toBe("haltbar");
    expect(classifyFreshness("")).toBe("haltbar");
  });
});

describe("suggestFreshShoppingDay", () => {
  it("returns the day before the earliest fresh-use date", () => {
    const thu = new Date(2026, 5, 11); // Thu 2026-06-11
    expect(suggestFreshShoppingDay(thu)).toEqual(new Date(2026, 5, 10)); // Wed
  });

  it("rolls over a month boundary", () => {
    const first = new Date(2026, 6, 1); // 2026-07-01
    expect(suggestFreshShoppingDay(first)).toEqual(new Date(2026, 5, 30)); // 2026-06-30
  });

  it("returns null when there is no fresh-use date", () => {
    expect(suggestFreshShoppingDay(null)).toBeNull();
  });
});

describe("normalizeIngredientName", () => {
  it("trimmt und lowercased", () => {
    expect(normalizeIngredientName("  Kokosmilch ")).toBe("kokosmilch");
    expect(normalizeIngredientName("TOMATEN")).toBe("tomaten");
  });
});

describe("resolveFreshness", () => {
  it("nutzt den gelernten Override (normalisierter Lookup)", () => {
    const overrides = new Map<string, Freshness>([["kokosmilch", "haltbar"]]);
    expect(resolveFreshness("Kokosmilch", overrides)).toBe("haltbar");
    expect(resolveFreshness("  KOKOSMILCH  ", overrides)).toBe("haltbar");
  });

  it("fällt ohne Override auf die Keyword-Heuristik zurück", () => {
    expect(resolveFreshness("Kokosmilch", new Map())).toBe("frisch"); // "milch"-Keyword greift fälschlich
    expect(resolveFreshness("Nudeln", new Map())).toBe("haltbar");
  });

  it("kann auch in Richtung frisch korrigieren", () => {
    const overrides = new Map<string, Freshness>([["nudeln", "frisch"]]);
    expect(resolveFreshness("Nudeln", overrides)).toBe("frisch");
  });
});
