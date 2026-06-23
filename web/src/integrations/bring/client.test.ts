import { describe, expect, it } from "vitest";

import { toBringItems } from "./client";

describe("toBringItems", () => {
  it("maps open shopping items to Bring push items by name", () => {
    const result = toBringItems([
      { text: "Tomaten", done: false },
      { text: "Milch", done: false },
    ]);

    expect(result).toEqual([{ name: "Tomaten" }, { name: "Milch" }]);
  });

  it("carries the quantity as the Bring spec line when present", () => {
    const result = toBringItems([
      { text: "Mehl", done: false, spec: "500 g" },
      { text: "Tomaten", done: false, spec: null },
    ]);

    expect(result).toEqual([{ name: "Mehl", spec: "500 g" }, { name: "Tomaten" }]);
  });

  it("excludes items that are already done", () => {
    const result = toBringItems([
      { text: "Tomaten", done: false },
      { text: "Brot", done: true },
    ]);

    expect(result.map((i) => i.name)).toEqual(["Tomaten"]);
  });

  it("returns an empty list when everything is done", () => {
    const result = toBringItems([{ text: "Brot", done: true }]);

    expect(result).toEqual([]);
  });
});
