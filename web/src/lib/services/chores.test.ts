import { describe, expect, it } from "vitest";

import { buildChoreTasks, CHORES } from "./chores";

const today = new Date(2026, 5, 12); // 12 Jun 2026, local midnight

describe("CHORES", () => {
  it("contains 17 chores", () => {
    expect(CHORES).toHaveLength(17);
  });

  it("Rasen mähen is Dome-only, outdoor, noRain", () => {
    const rasen = CHORES.find((c) => c.title === "Rasen mähen");
    expect(rasen?.allowedPersons).toBe("dome");
    expect(rasen?.outdoor).toBe(true);
    expect(rasen?.weatherCondition).toBe('{"noRain":true}');
  });

  it("Gassi gehen is outdoor but has no weather condition", () => {
    const gassi = CHORES.find((c) => c.title === "Gassi gehen");
    expect(gassi?.outdoor).toBe(true);
    expect(gassi?.weatherCondition).toBeNull();
  });

  it("shopping chores have no rhythm", () => {
    const einkauf = CHORES.find((c) => c.title === "Einkaufen");
    const futter = CHORES.find((c) => c.title === "Hundefutter kaufen");
    expect(einkauf?.type).toBe("shopping");
    expect(einkauf?.rhythm).toBeNull();
    expect(futter?.type).toBe("shopping");
    expect(futter?.rhythm).toBeNull();
  });

  it("every non-shopping chore has a rhythm", () => {
    for (const chore of CHORES) {
      if (chore.type !== "shopping") {
        expect(chore.rhythm, chore.title).not.toBeNull();
      }
    }
  });
});

describe("buildChoreTasks", () => {
  it("returns one task per chore with a dueDate", () => {
    const tasks = buildChoreTasks(today);
    expect(tasks).toHaveLength(17);
    for (const task of tasks) {
      expect(task.dueDate instanceof Date).toBe(true);
    }
  });

  it("staggers Bad groß and Bad klein onto different days", () => {
    const tasks = buildChoreTasks(today);
    const gross = tasks.find((t) => t.title === "Bad putzen (groß)");
    const klein = tasks.find((t) => t.title === "Bad putzen (klein)");
    expect(gross?.dueDate.getTime()).not.toBe(klein?.dueDate.getTime());
  });

  it("does not mutate the input date", () => {
    const original = new Date(today);
    buildChoreTasks(today);
    expect(today.getTime()).toBe(original.getTime());
  });
});
