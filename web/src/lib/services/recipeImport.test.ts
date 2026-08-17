import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { parseRecipeMarkdown } from "./recipeVault";
import {
  collectSteps,
  collectTags,
  extractRecipeSchema,
  fileNameFromRecipe,
  importedRecipeToVaultMarkdown,
  importRecipeFromUrl,
  normalizeRecipeUrl,
  parseIngredientLine,
  parseIsoDuration,
  parseNutritionNumber,
  parseServings,
  slugFromName,
  toImportedRecipe,
} from "./recipeImport";

function page(jsonLd: unknown, extraBlock = ""): string {
  return `<html><head>${extraBlock}<script type="application/ld+json">${JSON.stringify(
    jsonLd,
  )}</script></head><body>Rezept</body></html>`;
}

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Gemüse-Curry mit Kokosmilch",
  recipeYield: "4 Portionen",
  prepTime: "PT15M",
  cookTime: "PT25M",
  keywords: "vegetarisch, Curry, schnell",
  recipeCategory: "Hauptgericht",
  nutrition: { "@type": "NutritionInformation", calories: "420 kcal", proteinContent: "18 g" },
  recipeIngredient: [
    "400 ml Kokosmilch",
    "2 Süßkartoffel(n)",
    "2 EL Currypaste",
    "½ TL Salz",
    "n. B. Pfeffer",
    "Koriander",
  ],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Süßkartoffel würfeln und anbraten." },
    { "@type": "HowToStep", text: "Currypaste und Kokosmilch dazugeben." },
  ],
};

describe("extractRecipeSchema", () => {
  it("findet den Recipe-Knoten in einem einfachen Block", () => {
    expect(extractRecipeSchema(page(SCHEMA))?.name).toBe("Gemüse-Curry mit Kokosmilch");
  });

  it("findet ihn im @graph und in Arrays", () => {
    const graph = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage" }, SCHEMA] };
    expect(extractRecipeSchema(page(graph))?.name).toBe("Gemüse-Curry mit Kokosmilch");
    expect(extractRecipeSchema(page([{ "@type": "Organization" }, SCHEMA]))?.name).toBe(
      "Gemüse-Curry mit Kokosmilch",
    );
  });

  it("erkennt @type als Array", () => {
    expect(extractRecipeSchema(page({ ...SCHEMA, "@type": ["Recipe", "NewsArticle"] }))).not.toBeNull();
  });

  it("überspringt kaputte JSON-LD-Blöcke und findet den nächsten", () => {
    const broken = `<script type="application/ld+json">{ kaputt, </script>`;
    expect(extractRecipeSchema(page(SCHEMA, broken))?.name).toBe("Gemüse-Curry mit Kokosmilch");
  });

  it("liefert null ohne Rezeptdaten", () => {
    expect(extractRecipeSchema(page({ "@type": "Article", name: "Kein Rezept" }))).toBeNull();
    expect(extractRecipeSchema("<html><body>nix</body></html>")).toBeNull();
  });
});

describe("parseIngredientLine", () => {
  it("trennt Menge, Einheit und Namen", () => {
    expect(parseIngredientLine("400 ml Kokosmilch")).toEqual({
      name: "Kokosmilch",
      amount: "400",
      unit: "ml",
    });
    expect(parseIngredientLine("2 EL Currypaste")).toEqual({
      name: "Currypaste",
      amount: "2",
      unit: "EL",
    });
  });

  it("rechnet Brüche in deutsche Dezimalzahlen um", () => {
    expect(parseIngredientLine("½ TL Salz")).toEqual({ name: "Salz", amount: "0,5", unit: "TL" });
    expect(parseIngredientLine("1 1/2 TL Zucker")).toEqual({
      name: "Zucker",
      amount: "1,5",
      unit: "TL",
    });
  });

  it("behält Bereiche als Text", () => {
    expect(parseIngredientLine("2-3 Tomaten")).toEqual({ name: "Tomaten", amount: "2-3", unit: null });
  });

  it("räumt Chefkoch-Pluralklammern auf", () => {
    expect(parseIngredientLine("2 Süßkartoffel(n)")).toEqual({
      name: "Süßkartoffel",
      amount: "2",
      unit: null,
    });
    expect(parseIngredientLine("3 Ei(er)")).toEqual({ name: "Ei", amount: "3", unit: null });
  });

  it("erhält vage Mengenangaben", () => {
    expect(parseIngredientLine("n. B. Pfeffer")).toEqual({
      name: "Pfeffer",
      amount: "n. B.",
      unit: null,
    });
    expect(parseIngredientLine("etwas Öl")).toEqual({ name: "Öl", amount: "etwas", unit: null });
  });

  it("kommt ohne Menge aus", () => {
    expect(parseIngredientLine("Koriander")).toEqual({ name: "Koriander", amount: null, unit: null });
  });

  it("normalisiert Einheiten-Schreibweisen", () => {
    expect(parseIngredientLine("1 Pck. Backpulver")?.unit).toBe("Pck");
    expect(parseIngredientLine("2 Stück Paprika")?.unit).toBe("Stk");
    expect(parseIngredientLine("1 Bund Petersilie")?.unit).toBe("Bund");
  });

  it("hält Nicht-Einheiten aus dem unit-Feld raus", () => {
    expect(parseIngredientLine("2 rote Zwiebeln")).toEqual({
      name: "rote Zwiebeln",
      amount: "2",
      unit: null,
    });
  });

  it("verwirft leere Zeilen", () => {
    expect(parseIngredientLine("   ")).toBeNull();
    expect(parseIngredientLine("<span></span>")).toBeNull();
  });

  it("entfernt HTML und Entities", () => {
    expect(parseIngredientLine("<li>200 g S&uuml;&szlig;kartoffeln</li>")).toEqual({
      name: "Süßkartoffeln",
      amount: "200",
      unit: "g",
    });
  });

  it("versteht Bruch-Entities wie &frac12;", () => {
    expect(parseIngredientLine("&frac12; TL Paprikapulver")).toEqual({
      name: "Paprikapulver",
      amount: "0,5",
      unit: "TL",
    });
  });
});

describe("parseIsoDuration", () => {
  it("rechnet Stunden und Minuten zusammen", () => {
    expect(parseIsoDuration("PT1H30M")).toBe(90);
    expect(parseIsoDuration("PT25M")).toBe(25);
    expect(parseIsoDuration("P1DT2H")).toBe(1560);
  });

  it("liefert null bei Unsinn", () => {
    expect(parseIsoDuration("30 Minuten")).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
    expect(parseIsoDuration("PT0M")).toBeNull();
  });
});

describe("parseServings / parseNutritionNumber", () => {
  it("liest Portionen aus allen Varianten", () => {
    expect(parseServings("4 Portionen")).toBe(4);
    expect(parseServings(4)).toBe(4);
    expect(parseServings(["6 servings"])).toBe(6);
    expect(parseServings("nach Belieben")).toBeNull();
  });

  it("liest Nährwerte", () => {
    expect(parseNutritionNumber("420 kcal")).toBe(420);
    expect(parseNutritionNumber("18 g")).toBe(18);
    expect(parseNutritionNumber(512.4)).toBe(512);
    expect(parseNutritionNumber("keine Angabe")).toBeNull();
  });
});

describe("collectSteps", () => {
  it("liest HowToStep-Objekte", () => {
    expect(collectSteps(SCHEMA.recipeInstructions)).toEqual([
      "Süßkartoffel würfeln und anbraten.",
      "Currypaste und Kokosmilch dazugeben.",
    ]);
  });

  it("liest HowToSection mit itemListElement", () => {
    const sections = [
      {
        "@type": "HowToSection",
        name: "Teig",
        itemListElement: [{ "@type": "HowToStep", text: "Mehl mischen." }],
      },
    ];
    expect(collectSteps(sections)).toEqual(["Mehl mischen."]);
  });

  it("zerlegt HTML- und Fließtext-Anleitungen", () => {
    expect(collectSteps("<p>Zwiebeln schneiden.</p><p>Alles anbraten.</p>")).toEqual([
      "Zwiebeln schneiden.",
      "Alles anbraten.",
    ]);
    expect(collectSteps("Wasser kochen. Nudeln hineingeben.")).toEqual([
      "Wasser kochen.",
      "Nudeln hineingeben.",
    ]);
  });

  it("liefert eine leere Liste ohne Anleitung", () => {
    expect(collectSteps(undefined)).toEqual([]);
  });
});

describe("collectTags", () => {
  it("normalisiert und dedupliziert", () => {
    expect(collectTags(SCHEMA)).toEqual(["vegetarisch", "curry", "schnell", "hauptgericht"]);
  });

  it("verträgt Array-Keywords", () => {
    expect(collectTags({ keywords: ["Low Carb", "low carb"] })).toEqual(["low-carb"]);
  });
});

describe("slugFromName / fileNameFromRecipe", () => {
  it("transliteriert Umlaute", () => {
    expect(slugFromName("Gemüse-Curry mit Kokosmilch")).toBe("gemuese-curry-mit-kokosmilch");
    expect(slugFromName("Käsespätzle & Röstzwiebeln")).toBe("kaesespaetzle-roestzwiebeln");
  });

  it("baut einen Obsidian-tauglichen Dateinamen", () => {
    expect(fileNameFromRecipe("Pasta al Pomodoro", "pasta")).toBe("Pasta al Pomodoro.md");
    expect(fileNameFromRecipe("Salat: Feta/Melone", "salat")).toBe("Salat Feta Melone.md");
  });

  it("entfernt den führenden Unterstrich (den der Ingest überspringen würde)", () => {
    expect(fileNameFromRecipe("_Geheimrezept", "geheim")).toBe("Geheimrezept.md");
  });
});

describe("toImportedRecipe", () => {
  const recipe = toImportedRecipe(SCHEMA, "https://www.chefkoch.de/rezepte/1/Curry.html");

  it("übernimmt Kern- und Obsidian-Felder", () => {
    expect(recipe.id).toBe("gemuese-curry-mit-kokosmilch");
    expect(recipe.name).toBe("Gemüse-Curry mit Kokosmilch");
    expect(recipe.rating).toBe("ok");
    expect(recipe.servings).toBe(4);
    expect(recipe.prepMinutes).toBe(15);
    expect(recipe.cookMinutes).toBe(25);
    expect(recipe.kcal).toBe(420);
    expect(recipe.protein).toBe(18);
    expect(recipe.source).toBe("https://www.chefkoch.de/rezepte/1/Curry.html");
    expect(recipe.ingredients).toHaveLength(6);
    expect(recipe.steps).toHaveLength(2);
  });

  it("taggt kalorienarme Rezepte automatisch", () => {
    expect(recipe.tags[0]).toBe("kalorienarm");
    expect(toImportedRecipe({ ...SCHEMA, nutrition: { calories: "980 kcal" } }, "x").tags).not.toContain(
      "kalorienarm",
    );
  });

  it("setzt simple anhand Zeit und Zutatenzahl", () => {
    expect(recipe.simple).toBe(true);
    const aufwendig = toImportedRecipe({ ...SCHEMA, totalTime: "PT3H" }, "x");
    expect(aufwendig.simple).toBe(false);
  });

  it("wirft ohne Rezeptnamen", () => {
    expect(() => toImportedRecipe({ "@type": "Recipe" }, "x")).toThrow();
  });
});

describe("importedRecipeToVaultMarkdown", () => {
  const markdown = importedRecipeToVaultMarkdown(
    toImportedRecipe(SCHEMA, "https://www.chefkoch.de/rezepte/1/Curry.html"),
  );

  it("läuft durch den Vault-Parser des Dashboards zurück (Contract-Round-Trip)", () => {
    const { recipe, errors } = parseRecipeMarkdown(markdown);
    expect(errors).toEqual([]);
    expect(recipe).not.toBeNull();
    expect(recipe!.id).toBe("gemuese-curry-mit-kokosmilch");
    expect(recipe!.name).toBe("Gemüse-Curry mit Kokosmilch");
    expect(recipe!.rating).toBe("ok");
    expect(recipe!.simple).toBe(true);
    expect(recipe!.reheatable).toBe(false);
    expect(JSON.parse(recipe!.tags!)).toContain("kalorienarm");
    expect(recipe!.ingredients[0]).toEqual({ name: "Kokosmilch", amount: "400", unit: "ml" });
    expect(recipe!.ingredients.at(-1)).toEqual({ name: "Koriander", amount: null, unit: null });
  });

  it("schreibt Zubereitung und Quelle in den Body", () => {
    expect(markdown).toContain("## Zubereitung");
    expect(markdown).toContain("1. Süßkartoffel würfeln und anbraten.");
    expect(markdown).toContain("## Quelle");
    expect(markdown).toContain("https://www.chefkoch.de/rezepte/1/Curry.html");
  });

  it("kommt ohne Nährwerte/Portionen aus", () => {
    const minimal = importedRecipeToVaultMarkdown(
      toImportedRecipe({ "@type": "Recipe", name: "Nudeln mit Butter" }, "https://example.com/n"),
    );
    const { recipe, errors } = parseRecipeMarkdown(minimal);
    expect(errors).toEqual([]);
    expect(recipe!.name).toBe("Nudeln mit Butter");
    expect(recipe!.ingredients).toEqual([]);
    expect(minimal).not.toContain("nutrition");
  });
});

describe("importRecipeFromUrl", () => {
  const vaults: string[] = [];

  function makeVault(files: Record<string, string> = {}): string {
    const dir = mkdtempSync(path.join(tmpdir(), "recipe-import-"));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(dir, name), content);
    }
    vaults.push(dir);
    return dir;
  }

  function stubPage(html: string) {
    vi.stubGlobal("fetch", async () => new Response(html, { status: 200 }));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const dir of vaults.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const URL_CURRY = "https://www.chefkoch.de/rezepte/1/Curry.html";

  it("schreibt eine Notiz mit dem Rezeptnamen als Dateinamen", async () => {
    const vault = makeVault();
    stubPage(page(SCHEMA));

    const { recipe, file, updated } = await importRecipeFromUrl(URL_CURRY, vault);

    expect(updated).toBe(false);
    expect(path.basename(file)).toBe("Gemüse-Curry mit Kokosmilch.md");
    expect(readdirSync(vault)).toEqual(["Gemüse-Curry mit Kokosmilch.md"]);
    expect(recipe.id).toBe("gemuese-curry-mit-kokosmilch");

    const parsed = parseRecipeMarkdown(readFileSync(file, "utf8"));
    expect(parsed.errors).toEqual([]);
    expect(parsed.recipe!.ingredients).toHaveLength(6);
  });

  it("aktualisiert bei erneutem Import dieselbe Datei und behält die id", async () => {
    const vault = makeVault();
    stubPage(page(SCHEMA));
    const first = await importRecipeFromUrl(URL_CURRY, vault);

    // Die Seite benennt das Rezept um — Notiz und id müssen bleiben, sonst
    // entstünde ein zweites Rezept und das alte würde archiviert (Contract §3).
    stubPage(page({ ...SCHEMA, name: "Curry mit Kokos (neu)" }));
    const second = await importRecipeFromUrl(URL_CURRY, vault);

    expect(second.updated).toBe(true);
    expect(second.file).toBe(first.file);
    expect(second.recipe.id).toBe("gemuese-curry-mit-kokosmilch");
    expect(readdirSync(vault)).toHaveLength(1);
    expect(readFileSync(second.file, "utf8")).toContain("Curry mit Kokos (neu)");
  });

  it("erkennt ein bereits vorhandenes Rezept an gleicher id", async () => {
    const vault = makeVault({
      "Altes Curry.md": "---\nid: gemuese-curry-mit-kokosmilch\nname: Altes Curry\n---\n",
    });
    stubPage(page(SCHEMA));

    const { file, updated } = await importRecipeFromUrl(URL_CURRY, vault);

    expect(updated).toBe(true);
    expect(path.basename(file)).toBe("Altes Curry.md");
    expect(readdirSync(vault)).toHaveLength(1);
  });

  it("meldet Seiten ohne schema.org-Rezeptdaten verständlich", async () => {
    const vault = makeVault();
    stubPage("<html><body>nur ein Blogtext</body></html>");

    await expect(importRecipeFromUrl(URL_CURRY, vault)).rejects.toThrow(/schema\.org/);
    expect(readdirSync(vault)).toEqual([]);
  });

  it("meldet HTTP-Fehler", async () => {
    const vault = makeVault();
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 404 }));

    await expect(importRecipeFromUrl(URL_CURRY, vault)).rejects.toThrow(/404/);
  });
});

describe("normalizeRecipeUrl", () => {
  it("akzeptiert http(s) und trimmt", () => {
    expect(normalizeRecipeUrl("  https://example.com/rezept  ")).toBe("https://example.com/rezept");
  });

  it("weist alles andere ab", () => {
    expect(() => normalizeRecipeUrl("kein link")).toThrow();
    expect(() => normalizeRecipeUrl("file:///etc/passwd")).toThrow();
  });
});
