import { describe, expect, it } from "vitest";

import {
  buildRecipeQuery,
  isFilterActive,
  parseRecipeFilter,
  recipesHref,
  toggleField,
  toggleTag,
} from "./recipeFilterParams";

describe("parseRecipeFilter", () => {
  it("ergibt einen leeren Filter ohne Parameter", () => {
    expect(parseRecipeFilter({})).toEqual({});
  });

  it("liest alle Felder", () => {
    expect(
      parseRecipeFilter({
        q: "curry",
        tag: ["vegan", "schnell"],
        zutat: "linsen",
        kcal: "500",
        zeit: "30",
        bewertung: "favorit",
        einfach: "1",
        aufwaermbar: "1",
      }),
    ).toEqual({
      query: "curry",
      tags: ["vegan", "schnell"],
      ingredient: "linsen",
      maxKcal: 500,
      maxMinutes: 30,
      rating: "favorit",
      simpleOnly: true,
      reheatableOnly: true,
    });
  });

  it("nimmt einen einzelnen Tag auch ohne Array entgegen", () => {
    expect(parseRecipeFilter({ tag: "vegan" }).tags).toEqual(["vegan"]);
  });

  it("ignoriert leere und nur aus Leerzeichen bestehende Werte", () => {
    expect(parseRecipeFilter({ q: "   ", tag: ["", "vegan"], zutat: "" })).toEqual({
      tags: ["vegan"],
    });
  });

  it("ignoriert unsinnige Zahlen statt versehentlich alles wegzufiltern", () => {
    expect(parseRecipeFilter({ kcal: "abc" }).maxKcal).toBeUndefined();
    expect(parseRecipeFilter({ kcal: "-5" }).maxKcal).toBeUndefined();
    expect(parseRecipeFilter({ zeit: "0" }).maxMinutes).toBeUndefined();
    expect(parseRecipeFilter({ kcal: "450.7" }).maxKcal).toBe(450);
  });

  it("akzeptiert nur bekannte Bewertungen", () => {
    expect(parseRecipeFilter({ bewertung: "lecker" }).rating).toBeUndefined();
    expect(parseRecipeFilter({ bewertung: "selten" }).rating).toBe("selten");
  });

  it("behandelt Schalter nur bei '1' als an", () => {
    expect(parseRecipeFilter({ einfach: "0" }).simpleOnly).toBeUndefined();
    expect(parseRecipeFilter({ einfach: "true" }).simpleOnly).toBeUndefined();
    expect(parseRecipeFilter({ einfach: "1" }).simpleOnly).toBe(true);
  });
});

describe("buildRecipeQuery / recipesHref", () => {
  it("ist die Umkehrung von parseRecipeFilter", () => {
    const filter = {
      query: "curry",
      tags: ["vegan", "schnell"],
      ingredient: "linsen",
      maxKcal: 500,
      maxMinutes: 30,
      rating: "favorit",
      simpleOnly: true,
      reheatableOnly: true,
    };
    const params = Object.fromEntries(new URLSearchParams(buildRecipeQuery(filter)));
    // Mehrfachwerte gehen bei fromEntries verloren — Tags separat prüfen.
    expect(new URLSearchParams(buildRecipeQuery(filter)).getAll("tag")).toEqual([
      "vegan",
      "schnell",
    ]);
    expect(parseRecipeFilter({ ...params, tag: filter.tags })).toEqual(filter);
  });

  it("verlinkt ohne Fragezeichen, wenn nichts gefiltert wird", () => {
    expect(recipesHref({})).toBe("/mobile/meals/rezepte");
    expect(recipesHref({ query: "curry" })).toBe("/mobile/meals/rezepte?q=curry");
  });
});

describe("toggleTag", () => {
  it("fügt einen Tag hinzu und nimmt ihn beim zweiten Mal wieder raus", () => {
    const eins = toggleTag({}, "vegan");
    expect(eins.tags).toEqual(["vegan"]);
    const zwei = toggleTag(eins, "schnell");
    expect(zwei.tags).toEqual(["vegan", "schnell"]);
    expect(toggleTag(zwei, "vegan").tags).toEqual(["schnell"]);
  });

  it("entfernt das Tag-Feld ganz, wenn der letzte Tag abgewählt wird", () => {
    expect(toggleTag({ tags: ["vegan"] }, "vegan")).toEqual({});
  });

  it("lässt die übrigen Filter unberührt", () => {
    expect(toggleTag({ query: "curry", tags: ["vegan"] }, "vegan")).toEqual({ query: "curry" });
  });
});

describe("toggleField", () => {
  it("setzt einen Wert und entfernt ihn beim erneuten Klick auf denselben", () => {
    const gesetzt = toggleField({}, "rating", "favorit");
    expect(gesetzt.rating).toBe("favorit");
    expect(toggleField(gesetzt, "rating", "favorit")).toEqual({});
  });

  it("ersetzt einen anderen Wert, statt ihn abzuschalten", () => {
    expect(toggleField({ rating: "favorit" }, "rating", "selten").rating).toBe("selten");
  });
});

describe("isFilterActive", () => {
  it("erkennt einen leeren Filter", () => {
    expect(isFilterActive({})).toBe(false);
    expect(isFilterActive({ tags: [] })).toBe(false);
    expect(isFilterActive({ query: "curry" })).toBe(true);
  });
});
