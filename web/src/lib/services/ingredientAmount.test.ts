import { describe, expect, it } from "vitest";

import { combineAmounts } from "./ingredientAmount";

describe("combineAmounts", () => {
  it("returns null when there are no parts", () => {
    expect(combineAmounts([])).toBeNull();
  });

  it("returns null when no part carries an amount", () => {
    expect(combineAmounts([{ amount: null, unit: null }, { amount: "", unit: "g" }])).toBeNull();
  });

  it("formats a single amount with its unit", () => {
    expect(combineAmounts([{ amount: "500", unit: "g" }])).toBe("500 g");
  });

  it("formats a single amount without a unit", () => {
    expect(combineAmounts([{ amount: "6", unit: null }])).toBe("6");
  });

  it("sums amounts sharing the same unit", () => {
    expect(combineAmounts([{ amount: "200", unit: "g" }, { amount: "300", unit: "g" }])).toBe("500 g");
  });

  it("concatenates amounts with different units in first-seen order", () => {
    expect(
      combineAmounts([{ amount: "1", unit: "Stück" }, { amount: "200", unit: "g" }]),
    ).toBe("1 Stück + 200 g");
  });

  it("sums German decimal amounts and keeps the comma", () => {
    expect(combineAmounts([{ amount: "0,5", unit: "kg" }, { amount: "1", unit: "kg" }])).toBe("1,5 kg");
  });

  it("falls back to joining raw amounts when a value is not numeric", () => {
    expect(combineAmounts([{ amount: "etwas", unit: "Salz" }, { amount: "1", unit: "Salz" }])).toBe(
      "etwas Salz + 1 Salz",
    );
  });
});
