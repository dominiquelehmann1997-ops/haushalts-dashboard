import { describe, expect, it } from "vitest";

import { parseRecipeMarkdown, parseSteps, slugFromFilename } from "./recipeVault";

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
  - { name: rote Linsen, amount: 200, unit: g }
  - { name: Spinat, amount: 100, unit: g }
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

  it("coerces numeric amounts to strings", () => {
    const { recipe } = parseRecipeMarkdown(full);
    expect(recipe!.ingredients).toEqual([
      { name: "rote Linsen", amount: "200", unit: "g" },
      { name: "Spinat", amount: "100", unit: "g" },
      { name: "Salz", amount: null, unit: null },
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
    expect(recipe!.ingredients).toEqual([{ name: "Reis", amount: null, unit: null }]);
    expect(errors.some((e) => /ingredient/i.test(e))).toBe(true);
  });
});

describe("parseRecipeMarkdown — Felder, die der frühere Ingest verwarf", () => {
  // So sieht eine Notiz aus, die der URL-Importer geschrieben hat.
  const imported = `---
id: gemuese-curry-mit-kokosmilch
name: Gemüse-Curry mit Kokosmilch
rating: ok
simple: true
reheatable: false
source: https://www.chefkoch.de/rezepte/123
tags: [kalorienarm, vegetarisch]
servings: 4
prepMinutes: 15
cookMinutes: 25
nutrition:
  kcal: 420
  protein: 18
ingredients:
  - name: Kokosmilch
    amount: '400'
    unit: ml
---

## Zubereitung
1. Zwiebeln anschwitzen.
2. Gemüse zugeben, 20 min köcheln.

## Quelle
https://www.chefkoch.de/rezepte/123
`;

  it("liest Portionen, Zeiten und Nährwerte aus dem Frontmatter", () => {
    const { recipe, errors } = parseRecipeMarkdown(imported);
    expect(errors).toEqual([]);
    expect(recipe!.servings).toBe(4);
    expect(recipe!.prepMinutes).toBe(15);
    expect(recipe!.cookMinutes).toBe(25);
    expect(recipe!.kcal).toBe(420);
    expect(recipe!.protein).toBe(18);
  });

  it("übernimmt die Quell-URL", () => {
    const { recipe } = parseRecipeMarkdown(imported);
    expect(recipe!.sourceUrl).toBe("https://www.chefkoch.de/rezepte/123");
  });

  it("liest die Zubereitungsschritte ohne Listen-Nummerierung und ohne den Quelle-Abschnitt", () => {
    const { recipe } = parseRecipeMarkdown(imported);
    expect(recipe!.steps).toEqual([
      "Zwiebeln anschwitzen.",
      "Gemüse zugeben, 20 min köcheln.",
    ]);
  });

  it("lässt optionale Felder null, wenn sie fehlen — das ist kein Fehler", () => {
    const { recipe, errors } = parseRecipeMarkdown(`---\nname: Reste\n---\n`);
    expect(errors).toEqual([]);
    expect(recipe!.servings).toBeNull();
    expect(recipe!.kcal).toBeNull();
    expect(recipe!.protein).toBeNull();
    expect(recipe!.sourceUrl).toBeNull();
    expect(recipe!.steps).toEqual([]);
  });

  it("verwirft `source: claude` — das ist keine URL", () => {
    const md = `---\nname: Idee\nsource: claude\n---\n`;
    expect(parseRecipeMarkdown(md).recipe!.sourceUrl).toBeNull();
  });

  it("akzeptiert Zahlen auch als YAML-Strings", () => {
    const md = `---\nname: X\nservings: '6'\nnutrition:\n  kcal: '350'\n---\n`;
    const { recipe } = parseRecipeMarkdown(md);
    expect(recipe!.servings).toBe(6);
    expect(recipe!.kcal).toBe(350);
  });

  it("ignoriert unsinnige Zahlenwerte statt still 0 zu speichern", () => {
    const md = `---\nname: X\nservings: keine Ahnung\nprepMinutes: -5\n---\n`;
    const { recipe } = parseRecipeMarkdown(md);
    expect(recipe!.servings).toBeNull();
    expect(recipe!.prepMinutes).toBeNull();
  });
});

describe("parseSteps", () => {
  it("nimmt den Body bis zur ersten Überschrift, wenn es keine Zubereitung gibt", () => {
    expect(parseSteps("Alles in den Topf.\n\n## Quelle\nhttp://x")).toEqual([
      "Alles in den Topf.",
    ]);
  });

  it("versteht Aufzählungszeichen und Klammer-Nummerierung", () => {
    expect(parseSteps("## Zubereitung\n- Schneiden\n2) Braten\n* Servieren")).toEqual([
      "Schneiden",
      "Braten",
      "Servieren",
    ]);
  });

  it("gibt eine leere Liste für einen leeren Body zurück", () => {
    expect(parseSteps("")).toEqual([]);
    expect(parseSteps("\n\n   \n")).toEqual([]);
  });
});
