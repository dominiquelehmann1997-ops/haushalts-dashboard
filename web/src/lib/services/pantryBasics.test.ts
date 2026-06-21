import { describe, expect, it } from "vitest";
import { isPantryBasic } from "./pantryBasics";

describe("isPantryBasic", () => {
  it.each([
    ["Olivenöl", true],
    ["olivenöl", true],
    ["Sonnenblumenöl", true],
    ["Öl", true],
    ["Salz", true],
    ["Meersalz", true],
    ["Pfeffer", true],
    ["schwarzer Pfeffer", true],
    ["Oregano", true],
    ["Paprikapulver", true],
    ["Zimt", true],
    ["Kurkuma", true],
    ["Muskat", true],
    ["Lorbeerblatt", true],
    ["Backpulver", true],
    ["Natron", true],
    ["Essig", true],
    ["Balsamico-Essig", true],
    ["Sojasauce", true],
  ])("%s → true", (name, expected) => {
    expect(isPantryBasic(name)).toBe(expected);
  });

  it.each([
    ["Tomaten", false],
    ["Nudeln", false],
    ["Basilikum", false],   // frisches Kraut, muss gekauft werden
    ["Petersilie", false],
    ["Knoblauch", false],   // wird frisch gekauft
    ["Karotten", false],
    ["Käse", false],
    ["Tomatenmark", false], // bewusst nicht ausgeschlossen
    ["Senf", false],        // bewusst nicht ausgeschlossen
    ["Zucker", false],      // bewusst nicht ausgeschlossen
    ["Mehl", false],        // bewusst nicht ausgeschlossen
    ["", false],
  ])("%s → false", (name, expected) => {
    expect(isPantryBasic(name)).toBe(expected);
  });
});
