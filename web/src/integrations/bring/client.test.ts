import { describe, expect, it } from "vitest";

import { bringErrorMessage, mergeSpec, toBringItems } from "./client";

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

describe("bringErrorMessage", () => {
  it("treats the empty body of a successful save (HTTP 204) as success", () => {
    expect(bringErrorMessage("")).toBeNull();
    expect(bringErrorMessage("\n")).toBeNull();
  });

  it("surfaces the expired-session body that bring-shopping swallows", () => {
    const body = '{"message":"JWT access token is not valid","error":"invalid_token"}';

    expect(bringErrorMessage(body)).toBe("JWT access token is not valid");
  });

  it("falls back to the error code, then to the raw text", () => {
    expect(bringErrorMessage('{"error":"invalid_token"}')).toBe("invalid_token");
    expect(bringErrorMessage("<html>502 Bad Gateway</html>")).toBe("<html>502 Bad Gateway</html>");
  });
});

describe("mergeSpec", () => {
  it("keeps the quantity already on Bring and appends the new one", () => {
    expect(mergeSpec("6 Stück", "2 Stk")).toBe("6 Stück + 2 Stk");
  });

  it("leaves an existing quantity untouched when nothing new is pushed", () => {
    expect(mergeSpec("6 Stück", undefined)).toBe("6 Stück");
    expect(mergeSpec("6 Stück", "  ")).toBe("6 Stück");
  });

  it("does not duplicate a quantity that is already there", () => {
    expect(mergeSpec("500 g", "500 g")).toBe("500 g");
    expect(mergeSpec("6 Stück + 2 Stk", "2 Stk")).toBe("6 Stück + 2 Stk");
  });

  it("uses the pushed quantity when the item has none yet", () => {
    expect(mergeSpec(undefined, "500 g")).toBe("500 g");
    expect(mergeSpec("", "500 g")).toBe("500 g");
  });
});
