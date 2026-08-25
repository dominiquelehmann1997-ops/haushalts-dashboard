import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import type { Recipe } from "@/lib/domain";

import {
  EXPORT_MARKER,
  assignExportFileNames,
  isExportedFile,
  recipeToMarkdown,
} from "./recipeMarkdown";

/** Rezept mit allen Feldern leer — Tests setzen nur, worum es ihnen geht. */
function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "r1",
    name: "Kokos-Curry",
    slug: "kokos-curry",
    rating: "ok",
    simple: true,
    reheatable: false,
    tags: [],
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    kcal: null,
    protein: null,
    steps: [],
    notes: null,
    sourceUrl: null,
    imageUrl: null,
    archived: false,
    ingredients: [],
    ...overrides,
  };
}

const FULL = recipe({
  name: "Gemüse-Curry",
  slug: "gemuese-curry",
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
  notes: "Mit Limette abschmecken.",
  sourceUrl: "https://www.chefkoch.de/rezepte/1",
  ingredients: [
    { id: "i1", name: "Kokosmilch", amount: "400", unit: "ml" },
    { id: "i2", name: "Spinat", amount: null, unit: null },
  ],
});

describe("recipeToMarkdown", () => {
  it("schreibt alle Felder ins Frontmatter", () => {
    const { data } = matter(recipeToMarkdown(FULL));

    expect(data).toMatchObject({
      id: "gemuese-curry",
      name: "Gemüse-Curry",
      rating: "favorit",
      simple: false,
      reheatable: true,
      tags: ["curry", "vegan"],
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 25,
      nutrition: { kcal: 540, protein: 22 },
      source: "https://www.chefkoch.de/rezepte/1",
      exportedBy: EXPORT_MARKER,
    });
    expect(data.ingredients).toEqual([
      { name: "Kokosmilch", amount: "400", unit: "ml" },
      { name: "Spinat" },
    ]);
  });

  it("schreibt Zubereitung, Notizen und Quelle in den Body", () => {
    const { content } = matter(recipeToMarkdown(FULL));

    expect(content).toContain("## Zubereitung\n\n1. Zwiebeln anschwitzen.\n2. Kokosmilch zugeben.");
    expect(content).toContain("## Notizen\n\nMit Limette abschmecken.");
    expect(content).toContain("## Quelle\n\nhttps://www.chefkoch.de/rezepte/1");
  });

  it("lässt leere Felder ganz weg statt sie als null zu schreiben", () => {
    const out = recipeToMarkdown(recipe({ name: "Reste" }));
    const { data, content } = matter(out);

    expect(Object.keys(data).sort()).toEqual([
      "exportedBy",
      "id",
      "name",
      "rating",
      "reheatable",
      "simple",
    ]);
    expect(out).not.toContain("null");
    expect(content.trim()).toBe("");
  });

  it("schreibt nutrition auch, wenn nur eins von beiden gesetzt ist", () => {
    expect(matter(recipeToMarkdown(recipe({ kcal: 300 }))).data.nutrition).toEqual({ kcal: 300 });
    expect(matter(recipeToMarkdown(recipe({ protein: 12 }))).data.nutrition).toEqual({
      protein: 12,
    });
  });

  it("lässt id weg, wenn das Rezept keinen Slug hat (in der App angelegt)", () => {
    expect(matter(recipeToMarkdown(recipe({ slug: null }))).data.id).toBeUndefined();
  });

  it("markiert archivierte Rezepte, statt sie zu verschweigen", () => {
    expect(matter(recipeToMarkdown(recipe({ archived: true }))).data.archived).toBe(true);
    expect(matter(recipeToMarkdown(recipe())).data.archived).toBeUndefined();
  });

  it("faltet Zeilenumbrüche in einem Schritt zu Leerzeichen", () => {
    // Sonst zerfiele der Schritt beim Lesen in zwei — eine nummerierte Liste
    // ist zeilenbasiert.
    const out = recipeToMarkdown(recipe({ steps: ["Erst hacken,\n  dann braten."] }));
    expect(matter(out).content).toContain("1. Erst hacken, dann braten.");
  });

  it("ist deterministisch — gleiches Rezept, byte-gleiche Datei", () => {
    // Darauf verlässt sich der Export: nur so kann er unveränderte Dateien in
    // Ruhe lassen, statt Obsidian Sync jede Nacht alles neu übertragen zu lassen.
    expect(recipeToMarkdown(FULL)).toBe(recipeToMarkdown(FULL));
    expect(recipeToMarkdown(FULL)).not.toContain("exportedAt");
  });
});

describe("isExportedFile", () => {
  it("erkennt eine selbst geschriebene Exportdatei", () => {
    expect(isExportedFile(recipeToMarkdown(FULL))).toBe(true);
  });

  it("lässt fremde Notizen in Ruhe", () => {
    expect(isExportedFile("---\nname: Omas Auflauf\n---\n\nHandgeschrieben.\n")).toBe(false);
    expect(isExportedFile("Nur Text, kein Frontmatter.")).toBe(false);
    expect(isExportedFile("")).toBe(false);
  });

  it("wertet einen fremden exportedBy-Wert nicht als unsere Datei", () => {
    expect(isExportedFile("---\nexportedBy: irgendwer\n---\n")).toBe(false);
  });
});

describe("assignExportFileNames", () => {
  it("benennt nach slugFromName, mit transliterierten Umlauten", () => {
    const names = assignExportFileNames([{ id: "r1", name: "Gemüse-Curry" }]);
    expect(names.get("r1")).toBe("gemuese-curry.md");
  });

  it("weicht bei gleichem Namen auf die id aus, statt zu überschreiben", () => {
    // `Recipe.name` ist nicht unique — zwei „Ofengemüse" dürfen sich nicht
    // dieselbe Datei teilen.
    const names = assignExportFileNames([
      { id: "r1", name: "Ofengemüse" },
      { id: "r2", name: "Ofengemüse" },
    ]);
    expect(names.get("r1")).toBe("ofengemuese.md");
    expect(names.get("r2")).toBe("ofengemuese-r2.md");
  });

  it("fängt Namen ohne verwertbare Zeichen mit der id auf", () => {
    const names = assignExportFileNames([{ id: "r1", name: "???" }]);
    expect(names.get("r1")).toBe("rezept-r1.md");
  });
});
