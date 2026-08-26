import { describe, expect, it } from "vitest";

import { isVegetarian, withVegetarianTag } from "./vegetarianTag";

describe("vegetarianTag", () => {
  it("erkennt Fleisch und Fisch", () => {
    expect(isVegetarian([{ name: "Hähnchenbrust" }])).toBe(false);
    expect(isVegetarian([{ name: "Räucherlachs" }])).toBe(false);
    expect(isVegetarian([{ name: "Gelatine" }])).toBe(false);
  });

  it("hält mehrdeutige Wörter für vegetarisch", () => {
    // "hack" in "gehackt", "ham" in "Champignon", "rind" in "Tamarinde"
    expect(isVegetarian([{ name: "gehackte Tomaten" }])).toBe(true);
    expect(isVegetarian([{ name: "Champignons" }])).toBe(true);
    expect(isVegetarian([{ name: "Tamarindenpaste" }])).toBe(true);
  });

  it("setzt den Tag genau einmal und nur wenn vegetarisch", () => {
    expect(withVegetarianTag(["curry"], [{ name: "Linsen" }])).toEqual(["curry", "vegetarisch"]);
    expect(withVegetarianTag(["Vegetarisch"], [{ name: "Linsen" }])).toEqual(["Vegetarisch"]);
    expect(withVegetarianTag(["curry"], [{ name: "Rinderhack" }])).toEqual(["curry"]);
  });
});
