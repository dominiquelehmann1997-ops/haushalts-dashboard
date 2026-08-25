import { describe, expect, it } from "vitest";

import type { Recipe } from "@/lib/domain";
import {
  draftError,
  draftFromRecipe,
  draftToInput,
  emptyDraft,
  moveItem,
  parseOptionalInt,
  parseTagInput,
  splitSteps,
} from "./recipeForm";

const CURRY: Recipe = {
  id: "r1",
  name: "Kokos-Curry",
  slug: "kokos-curry",
  rating: "favorit",
  simple: false,
  reheatable: true,
  tags: ["curry", "vegan"],
  servings: 4,
  prepMinutes: 15,
  cookMinutes: 25,
  totalMinutes: 40,
  kcal: 540,
  protein: 22,
  steps: ["Zwiebeln anschwitzen.", "Kokosmilch zugeben."],
  notes: "Mit Naan servieren.",
  sourceUrl: "https://example.org/curry",
  imageUrl: null,
  archived: false,
  ingredients: [
    { id: "i1", name: "Kokosmilch", amount: "400", unit: "ml" },
    { id: "i2", name: "Spinat", amount: null, unit: null },
  ],
};

describe("draftFromRecipe / draftToInput", () => {
  it("läuft ohne Verlust hin und zurück", () => {
    const input = draftToInput(draftFromRecipe(CURRY));

    expect(input).toEqual({
      name: "Kokos-Curry",
      rating: "favorit",
      simple: false,
      reheatable: true,
      tags: ["curry", "vegan"],
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 25,
      kcal: 540,
      protein: 22,
      steps: ["Zwiebeln anschwitzen.", "Kokosmilch zugeben."],
      notes: "Mit Naan servieren.",
      sourceUrl: "https://example.org/curry",
      ingredients: [
        { name: "Kokosmilch", amount: "400", unit: "ml" },
        { name: "Spinat", amount: null, unit: null },
      ],
    });
  });

  it("zeigt fehlende Zahlen als leeres Feld statt als 0", () => {
    const draft = draftFromRecipe({ ...CURRY, servings: null, kcal: null });
    expect(draft.servings).toBe("");
    expect(draft.kcal).toBe("");
    expect(draftToInput(draft).servings).toBeNull();
  });

  it("gibt einem Rezept ohne Zutaten eine leere Zeile zum Tippen", () => {
    const draft = draftFromRecipe({ ...CURRY, ingredients: [] });
    expect(draft.ingredients).toEqual([{ name: "", amount: "", unit: "" }]);
  });

  it("wirft leere Zutatenzeilen beim Speichern weg", () => {
    const draft = emptyDraft();
    draft.name = "Reste";
    draft.ingredients = [
      { name: "  ", amount: "2", unit: "EL" },
      { name: " Reis ", amount: " 200 ", unit: " g " },
    ];
    expect(draftToInput(draft).ingredients).toEqual([{ name: "Reis", amount: "200", unit: "g" }]);
  });

  it("macht leere Textfelder zu null", () => {
    const draft = emptyDraft();
    draft.name = "Nudeln";
    const input = draftToInput(draft);
    expect(input.notes).toBeNull();
    expect(input.sourceUrl).toBeNull();
    expect(input.steps).toEqual([]);
    expect(input.tags).toEqual([]);
  });
});

describe("parseOptionalInt", () => {
  it("liest Zahlen, auch mit Komma", () => {
    expect(parseOptionalInt("15")).toBe(15);
    expect(parseOptionalInt(" 4 ")).toBe(4);
    expect(parseOptionalInt("2,5")).toBe(3);
  });

  it("liefert null statt einer erfundenen Zahl", () => {
    expect(parseOptionalInt("")).toBeNull();
    expect(parseOptionalInt("keine Ahnung")).toBeNull();
    expect(parseOptionalInt("-3")).toBeNull();
  });
});

describe("parseTagInput", () => {
  it("trennt, normalisiert und entdoppelt", () => {
    expect(parseTagInput("Curry, vegan ,  curry, ")).toEqual(["curry", "vegan"]);
  });

  it("macht aus mehrteiligen Tags einen Bindestrich-Tag", () => {
    expect(parseTagInput("schnelle Küche")).toEqual(["schnelle-küche"]);
  });
});

describe("splitSteps", () => {
  it("nimmt eine Zeile pro Schritt", () => {
    expect(splitSteps("Anbraten.\n\nAblöschen.\n")).toEqual(["Anbraten.", "Ablöschen."]);
  });

  it("entfernt mitkopierte Nummerierung und Aufzählungszeichen", () => {
    expect(splitSteps("1. Anbraten.\n2) Ablöschen.\n- Servieren.")).toEqual([
      "Anbraten.",
      "Ablöschen.",
      "Servieren.",
    ]);
  });

  it("lässt Zahlen im Text in Ruhe", () => {
    expect(splitSteps("Bei 180 Grad backen.")).toEqual(["Bei 180 Grad backen."]);
  });
});

describe("draftError", () => {
  it("verlangt einen Namen", () => {
    expect(draftError(emptyDraft())).toMatch(/Namen/);
    expect(draftError({ ...emptyDraft(), name: "Reste" })).toBeNull();
  });
});

describe("moveItem", () => {
  it("schiebt ein Element an die neue Stelle", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("lässt die Liste bei unmöglichen Zielen unverändert", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 1, 2)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
  });
});
