import { describe, expect, it } from "vitest";

import {
  RECENCY_FLOOR,
  VARIETY_FLOOR,
  parseTags,
  ratingWeight,
  recencyFactor,
  recipeWeight,
  varietyFactor,
  weightedPick,
} from "./mealWeights";

interface TestRecipe {
  id: string;
  rating: string;
}
const r = (id: string, rating = "ok"): TestRecipe => ({ id, rating });

describe("ratingWeight", () => {
  it("bildet favorit/ok/selten auf 3 / 1 / 0.3 ab", () => {
    expect(ratingWeight("favorit")).toBe(3);
    expect(ratingWeight("ok")).toBe(1);
    expect(ratingWeight("selten")).toBe(0.3);
  });

  it("behandelt unbekannte Ratings wie ok (Gewicht 1)", () => {
    expect(ratingWeight("quatsch")).toBe(1);
  });
});

describe("recencyFactor", () => {
  it("ist 1 ohne kürzliche Verwendung (null)", () => {
    expect(recencyFactor(null)).toBe(1);
  });

  it("ist 1 ab 14 Tagen", () => {
    expect(recencyFactor(14)).toBe(1);
    expect(recencyFactor(21)).toBe(1);
  });

  it("steigt linear innerhalb des Fensters (7 Tage → 0.5)", () => {
    expect(recencyFactor(7)).toBeCloseTo(0.5);
  });

  it("fällt nie unter den Floor (0 oder 1 Tag → RECENCY_FLOOR)", () => {
    expect(recencyFactor(0)).toBe(RECENCY_FLOOR);
    expect(recencyFactor(1)).toBe(RECENCY_FLOOR);
  });
});

describe("recipeWeight", () => {
  it("multipliziert Rating-Gewicht und Recency-Faktor", () => {
    expect(recipeWeight("favorit", 7)).toBeCloseTo(1.5);
    expect(recipeWeight("selten", null)).toBeCloseTo(0.3);
  });
});

describe("weightedPick", () => {
  const noRecent = new Map<string, number>();

  it("liefert null für einen leeren Pool", () => {
    expect(weightedPick([], noRecent, () => 0.5)).toBeNull();
  });

  it("rng 0 wählt das erste, rng nahe 1 das letzte Element (uniforme Gewichte)", () => {
    const pool = [r("a"), r("b"), r("c")];
    expect(weightedPick(pool, noRecent, () => 0)?.id).toBe("a");
    expect(weightedPick(pool, noRecent, () => 0.999)?.id).toBe("c");
  });

  it("ein favorit unter selten gewinnt die Rad-Mitte", () => {
    // Gewichte [3, 0.3, 0.3, 0.3, 0.3] → Summe 4.2; rng 0.5 → 2.1 < 3 → favorit
    const pool = [
      r("fav", "favorit"),
      r("s1", "selten"),
      r("s2", "selten"),
      r("s3", "selten"),
      r("s4", "selten"),
    ];
    expect(weightedPick(pool, noRecent, () => 0.5)?.id).toBe("fav");
    // Gegenprobe: rng 0.95 → 3.99 → hinter Kumulativ 3.9 → letztes Element
    expect(weightedPick(pool, noRecent, () => 0.95)?.id).toBe("s4");
  });

  it("Recency dämpft ein kürzlich verwendetes Rezept", () => {
    const pool = [r("recent"), r("other")];
    const recent = new Map([["recent", 0]]); // Gewicht 0.15 statt 1
    // ohne Dämpfung: rng 0.3 → 0.6 < 1 → "recent"
    expect(weightedPick(pool, noRecent, () => 0.3)?.id).toBe("recent");
    // mit Dämpfung: Summe 1.15; rng 0.3 → 0.345 > 0.15 → "other"
    expect(weightedPick(pool, recent, () => 0.3)?.id).toBe("other");
  });

  it("varietyFactors dämpfen ein Rezept mit schon genutztem Tag", () => {
    const pool = [r("pasta"), r("other")];
    // Variety: "pasta" auf 0.5 gedämpft, "other" neutral (1).
    const variety = new Map([["pasta", 0.5]]);
    // ohne Dämpfung: Gewichte [1,1] Summe 2; rng 0.4 → 0.8 < 1 → "pasta"
    expect(weightedPick(pool, noRecent, () => 0.4)?.id).toBe("pasta");
    // mit Dämpfung: Gewichte [0.5,1] Summe 1.5; rng 0.4 → 0.6 > 0.5 → "other"
    expect(weightedPick(pool, noRecent, () => 0.4, variety)?.id).toBe("other");
  });
});

describe("parseTags", () => {
  it("parst einen JSON-Array-String zu string[]", () => {
    expect(parseTags('["pasta","vegan"]')).toEqual(["pasta", "vegan"]);
  });

  it("liefert [] für null, leer oder ungültiges JSON", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags("kein json")).toEqual([]);
    expect(parseTags('{"a":1}')).toEqual([]); // kein Array
  });

  it("filtert Nicht-Strings aus dem Array", () => {
    expect(parseTags('["ok",1,null,"gut"]')).toEqual(["ok", "gut"]);
  });
});

describe("varietyFactor", () => {
  it("ist 1 ohne Tags oder ohne Überschneidung (neutral)", () => {
    expect(varietyFactor([], new Map())).toBe(1);
    expect(varietyFactor(["pasta"], new Map([["asiatisch", 2]]))).toBe(1);
  });

  it("halbiert pro Überschneidung (0.5^overlap)", () => {
    expect(varietyFactor(["pasta"], new Map([["pasta", 1]]))).toBeCloseTo(0.5);
    expect(varietyFactor(["pasta"], new Map([["pasta", 2]]))).toBeCloseTo(0.25);
    // Summe über mehrere Tags: pasta(1) + teig(1) = overlap 2 → 0.25
    expect(varietyFactor(["pasta", "teig"], new Map([["pasta", 1], ["teig", 1]]))).toBeCloseTo(0.25);
  });

  it("fällt nie unter den Floor", () => {
    expect(varietyFactor(["pasta"], new Map([["pasta", 99]]))).toBe(VARIETY_FLOOR);
  });
});
