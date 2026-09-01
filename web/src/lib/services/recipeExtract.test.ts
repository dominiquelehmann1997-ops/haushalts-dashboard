import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/claudeCli", () => ({ runClaude: vi.fn() }));

import { runClaude } from "@/lib/services/claudeCli";
import {
  buildExtractionPrompt,
  extractRecipeFromText,
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
  it("liest reines JSON ohne Prosa oder Fence", () => {
    expect(parseExtractionResponse(JSON.stringify(EXTRACTED))?.name).toBe("Linsen-Dal");
  });

  it("liest JSON auch mit Prosa und Code-Fence drumherum", () => {
    const raw = "Hier das Rezept:\n```json\n" + JSON.stringify(EXTRACTED) + "\n```\nViel Spaß!";
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("gibt null bei unlesbarer Antwort", () => {
    expect(parseExtractionResponse("Tut mir leid, kein Rezept gefunden.")).toBeNull();
  });

  it("ignoriert eine Klammer in Prosa VOR dem eigentlichen JSON", () => {
    const raw = "Bitte beachte {Hinweis}: " + JSON.stringify(EXTRACTED);
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("ignoriert eine Klammer in Prosa NACH dem eigentlichen JSON", () => {
    const raw = JSON.stringify(EXTRACTED) + "\nHinweis: Klammer {so}";
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("findet das JSON im Fence, auch wenn die umgebende Prosa selbst Klammern enthält", () => {
    const raw = "Vorher {a}\n```json\n" + JSON.stringify(EXTRACTED) + "\n```\nNachher {b}";
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("zerbricht nicht an einer Klammer im Rezeptnamen (String-Literal wird nicht mitgezählt)", () => {
    const withBrace = { ...EXTRACTED, name: 'Currywurst "Spezial" {Deluxe}' };
    const raw = "Vorher {a}\n" + JSON.stringify(withBrace) + "\nNachher {b}";
    expect(parseExtractionResponse(raw)?.name).toBe('Currywurst "Spezial" {Deluxe}');
  });

  it("weicht auf den Volltext aus, wenn im Fence kein gültiges JSON steht", () => {
    const raw =
      "```json\n{not valid json at all}\n```\n\nHere is the real one:\n" +
      JSON.stringify(EXTRACTED);
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("erholt sich von einer unbalancierten Klammer in Prosa vor dem JSON", () => {
    const raw =
      "Achtung: geschweifte Klammer { oeffnen ohne schliessen. " + JSON.stringify(EXTRACTED);
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("erholt sich von einer unbalancierten Klammer auch innerhalb eines Fence", () => {
    const raw =
      "```json\nAchtung: unklammer { vor dem JSON.\n" + JSON.stringify(EXTRACTED) + "\n```";
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("liest die Kategorie aus der Antwort", () => {
    const raw = JSON.stringify({ ...EXTRACTED, category: "suesses" });
    expect(parseExtractionResponse(raw)?.category).toBe("suesses");
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

  it("macht aus einer fehlenden Kategorie eine Hauptmahlzeit", () => {
    const imported = toImportedFromExtraction(EXTRACTED, null);
    expect(imported.category).toBe("hauptmahlzeit");
  });

  it("verwirft eine erfundene Kategorie", () => {
    const parsed = parseExtractionResponse(JSON.stringify({ ...EXTRACTED, category: "nachtisch" }));
    expect(toImportedFromExtraction(parsed!, null).category).toBe("hauptmahlzeit");
  });

  it("reicht eine gueltige Kategorie unveraendert durch", () => {
    const parsed = parseExtractionResponse(JSON.stringify({ ...EXTRACTED, category: "suesses" }));
    expect(toImportedFromExtraction(parsed!, null).category).toBe("suesses");
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

describe("extractRecipeFromText", () => {
  beforeEach(() => vi.mocked(runClaude).mockReset());

  it("ruft die CLI mit einem knapperen Timeout als runClaudes Default auf", async () => {
    vi.mocked(runClaude).mockResolvedValue(JSON.stringify(EXTRACTED));

    await extractRecipeFromText("irgendein Rohtext");

    expect(runClaude).toHaveBeenCalledTimes(1);
    expect(runClaude).toHaveBeenCalledWith(expect.any(String), { timeoutMs: 90_000 });
  });

  it("gibt dem Repair-Retry nur die Restzeit des gemeinsamen Budgets", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(runClaude)
        .mockImplementationOnce(async () => {
          vi.advanceTimersByTime(50_000); // Erstversuch verbraucht 50s …
          return JSON.stringify({ ...EXTRACTED, steps: [] }); // … und ist unbrauchbar
        })
        .mockResolvedValueOnce(JSON.stringify(EXTRACTED));

      await extractRecipeFromText("irgendein Rohtext");

      // … also bleiben dem Retry 40s, nicht noch einmal die vollen 90s.
      expect(runClaude).toHaveBeenNthCalledWith(2, expect.any(String), { timeoutMs: 40_000 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("verzichtet auf den Retry, wenn das Budget fast aufgebraucht ist", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(runClaude).mockImplementationOnce(async () => {
        vi.advanceTimersByTime(85_000);
        return JSON.stringify({ ...EXTRACTED, steps: [] });
      });

      await expect(extractRecipeFromText("irgendein Rohtext")).rejects.toThrow(
        /Keine Zubereitungsschritte/,
      );
      expect(runClaude).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
