import { describe, expect, it } from "vitest";

import type { RecipeIngredient } from "@/lib/domain";

import { MAX_PORTIONS, clampPortions, scaleAmount, scaleIngredients } from "./portions";

function ing(name: string, amount: string | null, unit: string | null = null): RecipeIngredient {
  return { id: name, name, amount, unit, section: null };
}

describe("clampPortions", () => {
  it("hält den Wert in den Grenzen und macht ihn ganzzahlig", () => {
    expect(clampPortions(0)).toBe(1);
    expect(clampPortions(-3)).toBe(1);
    expect(clampPortions(4)).toBe(4);
    expect(clampPortions(3.6)).toBe(4);
    expect(clampPortions(999)).toBe(MAX_PORTIONS);
  });

  it("fängt NaN ab", () => {
    expect(clampPortions(Number.NaN)).toBe(1);
  });
});

describe("scaleAmount", () => {
  it("skaliert ganze Zahlen", () => {
    expect(scaleAmount("400", 1.5)).toBe("600");
    expect(scaleAmount("2", 2)).toBe("4");
  });

  it("versteht deutsche Dezimalzahlen und gibt sie so zurück", () => {
    expect(scaleAmount("0,5", 2)).toBe("1");
    expect(scaleAmount("1,5", 2)).toBe("3");
    expect(scaleAmount("1", 0.5)).toBe("0,5");
  });

  it("lässt Bereiche und Textangaben unverändert — nichts wird erfunden", () => {
    expect(scaleAmount("2-3", 2)).toBe("2-3");
    expect(scaleAmount("etwas", 2)).toBe("etwas");
    expect(scaleAmount("n. B.", 3)).toBe("n. B.");
    expect(scaleAmount("1 Prise", 2)).toBe("1 Prise");
  });

  it("reicht null und Leerstrings durch", () => {
    expect(scaleAmount(null, 2)).toBeNull();
    expect(scaleAmount("", 2)).toBe("");
    expect(scaleAmount("   ", 2)).toBe("   ");
  });

  it("lässt bei Faktor 1 die Originalschreibweise stehen", () => {
    expect(scaleAmount("400", 1)).toBe("400");
    expect(scaleAmount("0,50", 1)).toBe("0,50");
  });

  it("rundet krumme Ergebnisse lesbar", () => {
    expect(scaleAmount("100", 1 / 3)).toBe("33,33");
  });
});

describe("scaleIngredients", () => {
  const zutaten = [ing("Kokosmilch", "400", "ml"), ing("Salz", null), ing("Chili", "2-3")];

  it("rechnet von den Ausgangsportionen auf die Zielportionen um", () => {
    const result = scaleIngredients(zutaten, 4, 6);
    expect(result.map((i) => i.amount)).toEqual(["600", null, "2-3"]);
  });

  it("halbiert korrekt", () => {
    expect(scaleIngredients(zutaten, 4, 2)[0].amount).toBe("200");
  });

  it("lässt Einheit und Name unangetastet", () => {
    const result = scaleIngredients(zutaten, 4, 8);
    expect(result[0]).toMatchObject({ name: "Kokosmilch", unit: "ml" });
  });

  it("rechnet nicht ohne bekannte Ausgangsportionen", () => {
    expect(scaleIngredients(zutaten, null, 8)).toBe(zutaten);
    expect(scaleIngredients(zutaten, 0, 8)).toBe(zutaten);
  });

  it("gibt bei gleicher Portionszahl die Originalliste zurück", () => {
    expect(scaleIngredients(zutaten, 4, 4)).toBe(zutaten);
  });
});
