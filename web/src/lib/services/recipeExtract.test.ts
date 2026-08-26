import { describe, expect, it } from "vitest";

import {
  buildExtractionPrompt,
  parseExtractionResponse,
  problemsOf,
  toImportedFromExtraction,
} from "./recipeExtract";

const EXTRACTED = {
  name: "Linsen-Dal",
  tags: ["indisch"],
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 25,
  ingredients: [
    { name: "Rote Linsen", amount: "200", unit: "g", section: null },
    { name: "Skyr", amount: "150", unit: "g", section: "Dip" },
  ],
  steps: ["Linsen waschen.", "25 Minuten köcheln."],
  nutrition: { basis: "pro Portion", kcal: 420, protein: 18, carbs: 55, fat: 9.4 },
};

describe("parseExtractionResponse", () => {
  it("liest JSON auch mit Prosa und Code-Fence drumherum", () => {
    const raw = "Hier das Rezept:\n```json\n" + JSON.stringify(EXTRACTED) + "\n```\nViel Spaß!";
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("gibt null bei unlesbarer Antwort", () => {
    expect(parseExtractionResponse("Tut mir leid, kein Rezept gefunden.")).toBeNull();
  });
});

describe("toImportedFromExtraction", () => {
  it("mappt auf ImportedRecipe inklusive Nährwerten und Gruppen", () => {
    const r = toImportedFromExtraction(EXTRACTED, "https://example.org/dal");
    expect(r.slug).toBe("linsen-dal");
    expect(r.source).toBe("https://example.org/dal");
    expect(r.kcal).toBe(420);
    expect(r.carbs).toBe(55);
    expect(r.fat).toBe(9); // gerundet, wie protein
    expect(r.ingredients[1].section).toBe("Dip");
    expect(r.rating).toBe("ok");
    expect(r.reheatable).toBe(false);
  });

  it("hängt den Tag vegetarisch an, wenn kein Fleisch drin ist", () => {
    expect(toImportedFromExtraction(EXTRACTED, null).tags).toEqual(["indisch", "vegetarisch"]);
  });

  it("verwirft Nährwerte, deren Bezug nicht die Portion ist", () => {
    const per100g = { ...EXTRACTED, nutrition: { ...EXTRACTED.nutrition, basis: "pro 100g" } };
    const r = toImportedFromExtraction(per100g, null);
    expect(r.kcal).toBeNull();
    expect(r.carbs).toBeNull();
    expect(r.fat).toBeNull();
    expect(r.protein).toBeNull();
  });
});

describe("problemsOf", () => {
  it("meldet leeren Namen, fehlende Zutaten und fehlende Schritte", () => {
    const empty = toImportedFromExtraction(
      { ...EXTRACTED, name: "   ", ingredients: [], steps: [] },
      null,
    );
    const problems = problemsOf(empty);
    expect(problems).toHaveLength(3);
    expect(problems.join(" ")).toMatch(/Name/);
  });

  it("ist still bei einem sauberen Rezept", () => {
    expect(problemsOf(toImportedFromExtraction(EXTRACTED, null))).toEqual([]);
  });
});

describe("buildExtractionPrompt", () => {
  it("kappt sehr langen Text und hängt den Repair-Hinweis an", () => {
    const prompt = buildExtractionPrompt("x".repeat(20_000), "Name fehlt");
    expect(prompt.length).toBeLessThan(20_000);
    expect(prompt).toContain("Name fehlt");
  });
});
