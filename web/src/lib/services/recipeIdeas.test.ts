import { describe, expect, it } from "vitest";

import { parseRecipeMarkdown } from "@/lib/services/recipeVault";
import {
  buildIdeasPrompt,
  parseIdeasResponse,
  recipeIdeaToVaultMarkdown,
  type RecipeIdea,
} from "@/lib/services/recipeIdeas";

const sampleIdea: RecipeIdea = {
  name: "Kürbis-Linsen-Curry",
  rating: "ok",
  simple: true,
  reheatable: true,
  tags: ["vegetarisch", "herbst"],
  ingredients: [
    { name: "Hokkaido-Kürbis", amount: "500", unit: "g", category: "frisch" },
    { name: "rote Linsen", amount: "200", unit: "g", category: "haltbar" },
    { name: "Kokosmilch", amount: "1", unit: "Dose", category: "haltbar" },
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

describe("recipeIdeaToVaultMarkdown", () => {
  it("round-trips through the vault parser", () => {
    const md = recipeIdeaToVaultMarkdown(sampleIdea);
    const { recipe, errors } = parseRecipeMarkdown(md);
    expect(errors).toEqual([]);
    expect(recipe).not.toBeNull();
    expect(recipe!.name).toBe(sampleIdea.name);
    expect(recipe!.rating).toBe("ok");
    expect(recipe!.reheatable).toBe(true);
    expect(recipe!.tags).toBe(JSON.stringify(sampleIdea.tags));
    expect(recipe!.ingredients).toHaveLength(3);
    expect(recipe!.ingredients[1]).toMatchObject({
      name: "rote Linsen",
      amount: "200",
      unit: "g",
      category: "haltbar",
    });
  });

  it("marks the source as claude so suggestions are identifiable in Obsidian", () => {
    const md = recipeIdeaToVaultMarkdown(sampleIdea);
    expect(md).toContain("source: claude");
  });

  it("includes the steps in the body", () => {
    const md = recipeIdeaToVaultMarkdown(sampleIdea);
    expect(md).toContain("Kürbis würfeln");
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
