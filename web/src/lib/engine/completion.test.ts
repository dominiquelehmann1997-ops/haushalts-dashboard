import { describe, expect, it } from "vitest";

import { recordCompletion } from "./completion";

describe("recordCompletion", () => {
  it("returns an account-entry input for a done, assigned task", () => {
    expect(
      recordCompletion({ id: "t1", title: "Rasen mähen", status: "done", effort: 3, assignedTo: "dome" }),
    ).toEqual({ personKey: "dome", points: 3, source: "planned", label: "Rasen mähen", taskId: "t1" });
  });

  it("returns null for an open task", () => {
    expect(
      recordCompletion({ id: "t2", title: "Spülen", status: "open", effort: 1, assignedTo: "dome" }),
    ).toBeNull();
  });

  it("returns null for a moved task", () => {
    expect(
      recordCompletion({ id: "t3", title: "Einkaufen", status: "moved", effort: 2, assignedTo: "emely" }),
    ).toBeNull();
  });

  it("returns null for a done task with no assignee", () => {
    expect(
      recordCompletion({ id: "t4", title: "Staubsaugen", status: "done", effort: 2, assignedTo: null }),
    ).toBeNull();
  });
});
