import { describe, expect, it } from "vitest";

import { planShoppingBatches } from "./shoppingBatches";

describe("planShoppingBatches", () => {
  it("C1: returns a single batch with all ingredients, mapped to Bring items", () => {
    const batches = planShoppingBatches(["Nudeln", "Tomaten", "Reis"]);
    expect(batches).toHaveLength(1);
    expect(batches[0].items).toEqual([
      { name: "Nudeln" },
      { name: "Tomaten" },
      { name: "Reis" },
    ]);
  });

  it("returns an empty batch list when there are no ingredients", () => {
    expect(planShoppingBatches([])).toEqual([]);
  });
});
