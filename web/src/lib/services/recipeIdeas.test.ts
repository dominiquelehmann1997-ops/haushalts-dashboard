import { describe, expect, it } from "vitest";

import {
  buildIdeasPrompt,
  parseIdeasResponse,
  recipeIdeaToImported,
  type RecipeIdea,
} from "@/lib/services/recipeIdeas";

const sampleIdea: RecipeIdea = {
  name: "Kürbis-Linsen-Curry",
  rating: "ok",
  simple: true,
  reheatable: true,
  tags: ["vegetarisch", "herbst"],
  ingredients: [
    { name: "Hokkaido-Kürbis", amount: "500", unit: "g" },
    { name: "rote Linsen", amount: "200", unit: "g" },
    { name: "Kokosmilch", amount: "1", unit: "Dose" },
  ],
  steps: "Kürbis würfeln, alles 20 Min köcheln.",
};

describe("parseIdeasResponse", () => {
  it("extracts a JSON array from a fenced code block with surrounding prose", () => {
    const raw =
      'Hier sind die Ideen:\n```json\n[{"name":"Test","ingredients":[{"name":"Salz"}]}]\n```\nGuten Appetit!';
    const ideas = parseIdeasResponse(raw);
    expect(ideas).toHaveLength(1);
    expect(ideas[0].name).toBe("Test");
    expect(ideas[0].ingredients[0].name).toBe("Salz");
  });

  it("parses a raw JSON array without fences", () => {
    const ideas = parseIdeasResponse('[{"name":"X","ingredients":[]}]');
    expect(ideas).toHaveLength(1);
    expect(ideas[0].name).toBe("X");
  });

  it("applies defaults for missing optional fields", () => {
    const ideas = parseIdeasResponse('[{"name":"X","ingredients":[]}]');
    expect(ideas[0].rating).toBe("ok");
    expect(ideas[0].simple).toBe(true);
    expect(ideas[0].reheatable).toBe(false);
    expect(ideas[0].tags).toEqual([]);
  });

  it("drops entries without a name", () => {
    const ideas = parseIdeasResponse('[{"ingredients":[]},{"name":"Keep","ingredients":[]}]');
    expect(ideas).toHaveLength(1);
    expect(ideas[0].name).toBe("Keep");
  });

  it("returns [] when no JSON array is present", () => {
    expect(parseIdeasResponse("Entschuldigung, keine Ideen.")).toEqual([]);
  });
});

describe("recipeIdeaToImported", () => {
  it("übernimmt die Idee samt Zutaten in die Import-Form", () => {
    const imported = recipeIdeaToImported(sampleIdea);

    expect(imported.name).toBe("Kürbis-Linsen-Curry");
    expect(imported.rating).toBe("ok");
    expect(imported.reheatable).toBe(true);
    expect(imported.tags).toEqual(["vegetarisch", "herbst"]);
    expect(imported.ingredients).toHaveLength(3);
    expect(imported.ingredients[1]).toEqual({ name: "rote Linsen", amount: "200", unit: "g" });
  });

  it("transliteriert Umlaute im Slug (statt sie zu zerlegen)", () => {
    expect(recipeIdeaToImported(sampleIdea).slug).toBe("kuerbis-linsen-curry");
  });

  it("gibt Ideen keine Quell-URL", () => {
    expect(recipeIdeaToImported(sampleIdea).source).toBeNull();
  });

  it("zerlegt die Zubereitung in Schritte und setzt die Portionen des Prompts", () => {
    const imported = recipeIdeaToImported({
      ...sampleIdea,
      steps: "1. Kürbis würfeln.\n2. Alles 20 Min köcheln.",
    });
    expect(imported.steps).toEqual(["Kürbis würfeln.", "Alles 20 Min köcheln."]);
    expect(imported.servings).toBe(4);
  });

  it("kommt ohne Zubereitung aus", () => {
    const { steps, ...rest } = sampleIdea;
    void steps;
    expect(recipeIdeaToImported(rest).steps).toEqual([]);
  });
});

describe("buildIdeasPrompt", () => {
  it("lists existing recipe names so the model avoids duplicates", () => {
    const prompt = buildIdeasPrompt(["Spaghetti Bolognese", "Linsensuppe"], { count: 3 });
    expect(prompt).toContain("Spaghetti Bolognese");
    expect(prompt).toContain("Linsensuppe");
    expect(prompt).toContain("3");
  });

  it("asks for JSON output", () => {
    const prompt = buildIdeasPrompt([], { count: 1 });
    expect(prompt.toLowerCase()).toContain("json");
  });
});
