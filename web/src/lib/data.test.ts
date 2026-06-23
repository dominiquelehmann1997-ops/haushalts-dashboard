import { describe, it, expect } from "vitest";
import { personFill } from "./data";

describe("personFill", () => {
  it("returns the person's own fill class", () => {
    expect(personFill("dome")).toBe("bg-dome");
    expect(personFill("emely")).toBe("bg-emely");
  });

  // Regression: getTasksForDay surfaces unassigned tasks (assignedTo == null),
  // so person is undefined. TaskRow's done-marker must not crash on the missing
  // PERSON entry — it falls back to a neutral grey.
  it("falls back to neutral grey for unassigned tasks", () => {
    expect(personFill(undefined)).toBe("bg-ink-faint");
    expect(personFill(null)).toBe("bg-ink-faint");
  });
});
