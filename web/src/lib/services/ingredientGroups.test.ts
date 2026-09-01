import { describe, expect, it } from "vitest";

import { groupIngredientsBySection, hasSections } from "./ingredientGroups";

const z = (name: string, section: string | null) => ({ name, section });

describe("hasSections", () => {
  it("ist false, wenn keine Zutat eine Gruppe trägt", () => {
    expect(hasSections([z("Linsen", null), z("Skyr", null)])).toBe(false);
    expect(hasSections([])).toBe(false);
  });

  it("ist true, sobald eine einzige Zutat eine Gruppe trägt", () => {
    expect(hasSections([z("Linsen", null), z("Skyr", "Dip")])).toBe(true);
  });

  it("ignoriert Gruppen, die nur aus Leerraum bestehen", () => {
    expect(hasSections([z("Linsen", "   ")])).toBe(false);
  });
});

describe("groupIngredientsBySection", () => {
  it("gibt bei Rezepten ohne Gruppen genau eine Gruppe ohne Überschrift zurück", () => {
    const gruppen = groupIngredientsBySection([z("Linsen", null), z("Kokosmilch", null)]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0].section).toBeNull();
    expect(gruppen[0].items.map((i) => i.name)).toEqual(["Linsen", "Kokosmilch"]);
  });

  it("trennt aufeinanderfolgende Gruppen und behält die Reihenfolge", () => {
    const gruppen = groupIngredientsBySection([
      z("Hähnchenbrust", "Für die Nuggets"),
      z("Cornflakes", "Für die Nuggets"),
      z("Skyr", "Dip"),
      z("Paprikapulver", "Dip"),
    ]);
    expect(gruppen.map((g) => g.section)).toEqual(["Für die Nuggets", "Dip"]);
    expect(gruppen[0].items.map((i) => i.name)).toEqual(["Hähnchenbrust", "Cornflakes"]);
    expect(gruppen[1].items.map((i) => i.name)).toEqual(["Skyr", "Paprikapulver"]);
  });

  it("führt Zutaten vor der ersten Überschrift als Gruppe ohne Titel", () => {
    const gruppen = groupIngredientsBySection([
      z("Olivenöl", null),
      z("Skyr", "Dip"),
    ]);
    expect(gruppen.map((g) => g.section)).toEqual([null, "Dip"]);
    expect(gruppen[0].items.map((i) => i.name)).toEqual(["Olivenöl"]);
  });

  it("fasst gleichnamige Gruppen NICHT über eine andere Gruppe hinweg zusammen", () => {
    // Die Quellreihenfolge ist die Kochreihenfolge — Umsortieren waere falsch.
    const gruppen = groupIngredientsBySection([
      z("Mehl", "Teig"),
      z("Skyr", "Dip"),
      z("Zucker", "Teig"),
    ]);
    expect(gruppen.map((g) => g.section)).toEqual(["Teig", "Dip", "Teig"]);
  });

  it("behandelt Leerraum-Gruppen wie keine Gruppe", () => {
    const gruppen = groupIngredientsBySection([z("Linsen", "  "), z("Skyr", null)]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0].section).toBeNull();
  });

  it("verliert keine Zutat", () => {
    const zutaten = [z("a", null), z("b", "X"), z("c", "X"), z("d", "Y")];
    const gruppen = groupIngredientsBySection(zutaten);
    expect(gruppen.flatMap((g) => g.items)).toHaveLength(zutaten.length);
  });

  it("gibt bei leerer Liste keine Gruppe zurück", () => {
    expect(groupIngredientsBySection([])).toEqual([]);
  });
});
