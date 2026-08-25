import { describe, expect, it } from "vitest";

import type { Recipe } from "@/lib/domain";

import {
  applyFilters,
  collectTags,
  hasIngredient,
  matchesQuery,
  normalizeSearchText,
} from "./recipeSearch";

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: "r1",
    name: "Gemüse-Curry",
    slug: "gemuese-curry",
    rating: "ok",
    simple: true,
    reheatable: false,
    tags: ["curry", "vegetarisch"],
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    totalMinutes: 40,
    kcal: 420,
    protein: 18,
    steps: ["Zwiebeln anschwitzen.", "Kokosmilch zugeben."],
    notes: null,
    sourceUrl: null,
    imageUrl: null,
    archived: false,
    ingredients: [
      { id: "i1", name: "Kokosmilch", amount: "400", unit: "ml" },
      { id: "i2", name: "Süßkartoffel", amount: "2", unit: null },
    ],
    ...over,
  };
}

describe("normalizeSearchText", () => {
  it("transliteriert Umlaute und schreibt klein", () => {
    expect(normalizeSearchText("Gemüse")).toBe("gemuese");
    expect(normalizeSearchText("SÜSSKARTOFFEL")).toBe("suesskartoffel");
    expect(normalizeSearchText("Soße")).toBe("sosse");
  });
});

describe("matchesQuery", () => {
  const r = recipe();

  it("findet mit und ohne Umlaut", () => {
    expect(matchesQuery(r, "gemüse")).toBe(true);
    expect(matchesQuery(r, "gemuese")).toBe(true);
    expect(matchesQuery(r, "GEMÜSE")).toBe(true);
  });

  it("sucht auch in Tags, Zutaten und Zubereitung", () => {
    expect(matchesQuery(r, "vegetarisch")).toBe(true);
    expect(matchesQuery(r, "kokosmilch")).toBe(true);
    expect(matchesQuery(r, "anschwitzen")).toBe(true);
  });

  it("verknüpft mehrere Wörter mit UND, feldübergreifend", () => {
    expect(matchesQuery(r, "curry kokosmilch")).toBe(true);
    expect(matchesQuery(r, "curry lachs")).toBe(false);
  });

  it("trifft bei leerer Suche alles", () => {
    expect(matchesQuery(r, "")).toBe(true);
    expect(matchesQuery(r, "   ")).toBe(true);
  });

  it("durchsucht die Notizen mit", () => {
    expect(matchesQuery(recipe({ notes: "Omas Rezept" }), "omas")).toBe(true);
  });
});

describe("hasIngredient", () => {
  it("matcht Teilstrings umlautunabhängig", () => {
    expect(hasIngredient(recipe(), "süßkartoffel")).toBe(true);
    expect(hasIngredient(recipe(), "suesskartoffel")).toBe(true);
    expect(hasIngredient(recipe(), "kokos")).toBe(true);
    expect(hasIngredient(recipe(), "lachs")).toBe(false);
  });
});

describe("applyFilters", () => {
  const curry = recipe();
  const pasta = recipe({
    id: "r2",
    name: "Pasta al Pomodoro",
    tags: ["pasta"],
    kcal: 650,
    totalMinutes: 20,
    rating: "favorit",
    simple: true,
    reheatable: true,
    ingredients: [{ id: "i3", name: "Nudeln", amount: "500", unit: "g" }],
    steps: [],
  });
  const unbekannt = recipe({
    id: "r3",
    name: "Reste",
    tags: [],
    kcal: null,
    totalMinutes: null,
    ingredients: [],
    steps: [],
  });
  const all = [curry, pasta, unbekannt];

  it("filtert nichts, wenn nichts gesetzt ist", () => {
    expect(applyFilters(all, {})).toHaveLength(3);
  });

  it("verknüpft mehrere Tags mit UND", () => {
    expect(applyFilters(all, { tags: ["curry"] }).map((r) => r.id)).toEqual(["r1"]);
    expect(applyFilters(all, { tags: ["curry", "vegetarisch"] })).toHaveLength(1);
    expect(applyFilters(all, { tags: ["curry", "pasta"] })).toHaveLength(0);
  });

  it("schließt Rezepte ohne kcal-Angabe von einem kcal-Filter aus", () => {
    const res = applyFilters(all, { maxKcal: 500 });
    expect(res.map((r) => r.id)).toEqual(["r1"]);
  });

  it("schließt Rezepte ohne Zeitangabe von einem Zeitfilter aus", () => {
    expect(applyFilters(all, { maxMinutes: 30 }).map((r) => r.id)).toEqual(["r2"]);
  });

  it("filtert nach Bewertung, einfach und aufwärmbar", () => {
    expect(applyFilters(all, { rating: "favorit" }).map((r) => r.id)).toEqual(["r2"]);
    expect(applyFilters(all, { reheatableOnly: true }).map((r) => r.id)).toEqual(["r2"]);
    expect(applyFilters(all, { simpleOnly: true })).toHaveLength(3);
  });

  it("kombiniert Suche, Zutat und Grenzwerte", () => {
    expect(
      applyFilters(all, { query: "curry", ingredient: "kokos", maxKcal: 500 }).map((r) => r.id),
    ).toEqual(["r1"]);
    expect(applyFilters(all, { query: "curry", maxKcal: 100 })).toHaveLength(0);
  });
});

describe("collectTags", () => {
  it("zählt Tags und sortiert nach Häufigkeit, dann alphabetisch", () => {
    const list = [
      recipe({ id: "a", tags: ["curry", "vegan"] }),
      recipe({ id: "b", tags: ["curry", "schnell"] }),
      recipe({ id: "c", tags: ["curry"] }),
    ];
    expect(collectTags(list)).toEqual([
      { tag: "curry", count: 3 },
      { tag: "schnell", count: 1 },
      { tag: "vegan", count: 1 },
    ]);
  });

  it("liefert eine leere Liste, wenn niemand Tags hat", () => {
    expect(collectTags([recipe({ tags: [] })])).toEqual([]);
  });
});
