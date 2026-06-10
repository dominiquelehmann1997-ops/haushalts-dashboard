import { describe, expect, it } from "vitest";

import { parseRecipeMarkdown, slugFromFilename } from "./recipeVault";

describe("slugFromFilename", () => {
  it("strips .md, lowercases, and dasherizes", () => {
    expect(slugFromFilename("Kokos-Curry mit Linsen.md")).toBe("kokos-curry-mit-linsen");
    expect(slugFromFilename("Pasta al Pomodoro.md")).toBe("pasta-al-pomodoro");
  });

  it("collapses runs of non-alphanumerics and trims dashes", () => {
    expect(slugFromFilename("  Reste!!  .md")).toBe("reste");
    expect(slugFromFilename("Gemüse-Curry.md")).toBe("gem-se-curry");
  });
});

describe("parseRecipeMarkdown", () => {
  const full = `---
id: kokos-curry-linsen
name: Kokos-Curry mit Linsen
rating: favorit
simple: true
reheatable: true
tags: [curry, vegan]
servings: 4
ingredients:
  - { name: rote Linsen, amount: 200, unit: g, freshness: haltbar }
  - { name: Spinat, amount: 100, unit: g, freshness: frisch }
  - { name: Salz }
---

## Zubereitung
1. Kochen.
`;

  it("parses a full recipe", () => {
    const { recipe, errors } = parseRecipeMarkdown(full);
    expect(errors).toEqual([]);
    expect(recipe).not.toBeNull();
    expect(recipe!.id).toBe("kokos-curry-linsen");
    expect(recipe!.name).toBe("Kokos-Curry mit Linsen");
    expect(recipe!.rating).toBe("favorit");
    expect(recipe!.simple).toBe(true);
    expect(recipe!.reheatable).toBe(true);
    expect(recipe!.tags).toBe('["curry","vegan"]');
  });

  it("coerces numeric amounts to strings and maps freshness to category", () => {
    const { recipe } = parseRecipeMarkdown(full);
    expect(recipe!.ingredients).toEqual([
      { name: "rote Linsen", amount: "200", unit: "g", category: "haltbar" },
      { name: "Spinat", amount: "100", unit: "g", category: "frisch" },
      { name: "Salz", amount: null, unit: null, category: null },
    ]);
  });

  it("defaults rating to 'ok' and simple to true when absent/invalid", () => {
    const md = `---\nname: Reste\nrating: lecker\n---\n`;
    const { recipe } = parseRecipeMarkdown(md);
    expect(recipe!.rating).toBe("ok");
    expect(recipe!.simple).toBe(true);
    expect(recipe!.reheatable).toBe(false);
    expect(recipe!.tags).toBeNull();
    expect(recipe!.ingredients).toEqual([]);
  });

  it("returns id null when frontmatter has no id (caller derives slug)", () => {
    const md = `---\nname: Reste\n---\n`;
    const { recipe } = parseRecipeMarkdown(md);
    expect(recipe!.id).toBeNull();
  });

  it("returns recipe null with an error when name is missing", () => {
    const { recipe, errors } = parseRecipeMarkdown(`---\nrating: ok\n---\n`);
    expect(recipe).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/name/i);
  });

  it("skips ingredient entries without a name but keeps the rest", () => {
    const md = `---\nname: X\ningredients:\n  - { amount: 1 }\n  - { name: Reis }\n---\n`;
    const { recipe, errors } = parseRecipeMarkdown(md);
    expect(recipe!.ingredients).toEqual([{ name: "Reis", amount: null, unit: null, category: null }]);
    expect(errors.some((e) => /ingredient/i.test(e))).toBe(true);
  });
});
