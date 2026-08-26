import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectSteps,
  collectTags,
  extractRecipeSchema,
  importRecipeFromUrl,
  normalizeRecipeUrl,
  parseIngredientLine,
  parseIsoDuration,
  parseNutritionNumber,
  parseServings,
  pickImageUrl,
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
  image: [{ "@type": "ImageObject", url: "https://img.chefkoch.de/curry.jpg" }],
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

describe("pickImageUrl", () => {
  const PAGE = "https://www.chefkoch.de/rezepte/1/Curry.html";

  it("nimmt einen einfachen String", () => {
    expect(pickImageUrl("https://img.chefkoch.de/curry.jpg", PAGE)).toBe(
      "https://img.chefkoch.de/curry.jpg",
    );
  });

  it("nimmt das erste Bild einer Liste", () => {
    expect(pickImageUrl(["https://img.example/a.jpg", "https://img.example/b.jpg"], PAGE)).toBe(
      "https://img.example/a.jpg",
    );
  });

  it("liest ImageObject-Knoten aus (auch verschachtelt in einer Liste)", () => {
    expect(pickImageUrl({ "@type": "ImageObject", url: "https://img.example/c.jpg" }, PAGE)).toBe(
      "https://img.example/c.jpg",
    );
    expect(pickImageUrl([{ contentUrl: "https://img.example/d.jpg" }], PAGE)).toBe(
      "https://img.example/d.jpg",
    );
  });

  it("löst relative Pfade gegen die Seiten-URL auf", () => {
    expect(pickImageUrl("/bilder/curry.jpg", PAGE)).toBe("https://www.chefkoch.de/bilder/curry.jpg");
  });

  it("weist Platzhalter und Unsinn ab", () => {
    expect(pickImageUrl("data:image/gif;base64,R0lGOD", PAGE)).toBeNull();
    expect(pickImageUrl("", PAGE)).toBeNull();
    expect(pickImageUrl(undefined, PAGE)).toBeNull();
    expect(pickImageUrl({ width: 800 }, PAGE)).toBeNull();
  });

  it("hängt sich nicht in zyklischen Strukturen auf", () => {
    const loop: Record<string, unknown> = {};
    loop.url = loop;
    expect(pickImageUrl(loop, PAGE)).toBeNull();
  });
});

describe("slugFromName", () => {
  it("transliteriert Umlaute", () => {
    expect(slugFromName("Gemüse-Curry mit Kokosmilch")).toBe("gemuese-curry-mit-kokosmilch");
    expect(slugFromName("Käsespätzle & Röstzwiebeln")).toBe("kaesespaetzle-roestzwiebeln");
  });
});

describe("toImportedRecipe", () => {
  const recipe = toImportedRecipe(SCHEMA, "https://www.chefkoch.de/rezepte/1/Curry.html");

  it("übernimmt alle Rezeptfelder", () => {
    expect(recipe.slug).toBe("gemuese-curry-mit-kokosmilch");
    expect(recipe.name).toBe("Gemüse-Curry mit Kokosmilch");
    expect(recipe.rating).toBe("ok");
    expect(recipe.servings).toBe(4);
    expect(recipe.prepMinutes).toBe(15);
    expect(recipe.cookMinutes).toBe(25);
    expect(recipe.kcal).toBe(420);
    expect(recipe.protein).toBe(18);
    expect(recipe.source).toBe("https://www.chefkoch.de/rezepte/1/Curry.html");
    expect(recipe.imageUrl).toBe("https://img.chefkoch.de/curry.jpg");
    expect(recipe.ingredients).toHaveLength(6);
    expect(recipe.ingredients[0]).toEqual({ name: "Kokosmilch", amount: "400", unit: "ml" });
    expect(recipe.ingredients.at(-1)).toEqual({ name: "Koriander", amount: null, unit: null });
    expect(recipe.steps).toHaveLength(2);
  });

  it("liest Kohlenhydrate und Fett aus dem Nährwert-Block", () => {
    const schema = {
      ...SCHEMA,
      nutrition: {
        "@type": "NutritionInformation",
        calories: "420 kcal",
        proteinContent: "18 g",
        carbohydrateContent: "55 g",
        fatContent: "9,5 g",
      },
    };
    const recipe = toImportedRecipe(schema, "https://example.org/rezept");
    expect(recipe.carbs).toBe(55);
    expect(recipe.fat).toBe(10);
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

  it("kommt ohne Nährwerte und Zutaten aus", () => {
    const minimal = toImportedRecipe({ "@type": "Recipe", name: "Nudeln mit Butter" }, "https://example.com/n");
    expect(minimal.kcal).toBeNull();
    expect(minimal.servings).toBeNull();
    expect(minimal.ingredients).toEqual([]);
  });

  it("wirft ohne Rezeptnamen", () => {
    expect(() => toImportedRecipe({ "@type": "Recipe" }, "x")).toThrow();
  });
});

describe("importRecipeFromUrl", () => {
  function stubPage(html: string) {
    vi.stubGlobal("fetch", async () => new Response(html, { status: 200 }));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const URL_CURRY = "https://www.chefkoch.de/rezepte/1/Curry.html";

  it("holt die Seite und liefert das Rezept", async () => {
    stubPage(page(SCHEMA));

    const recipe = await importRecipeFromUrl(URL_CURRY);

    expect(recipe.slug).toBe("gemuese-curry-mit-kokosmilch");
    expect(recipe.source).toBe(URL_CURRY);
    expect(recipe.ingredients).toHaveLength(6);
  });

  it("meldet Seiten ohne schema.org-Rezeptdaten verständlich", async () => {
    stubPage("<html><body>nur ein Blogtext</body></html>");

    await expect(importRecipeFromUrl(URL_CURRY)).rejects.toThrow(/schema\.org/);
  });

  it("meldet HTTP-Fehler", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 404 }));

    await expect(importRecipeFromUrl(URL_CURRY)).rejects.toThrow(/404/);
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
