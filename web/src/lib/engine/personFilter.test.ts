import { describe, expect, it } from "vitest";

import { filterByPerson } from "./personFilter";
import type { EngineTask, PersonKey } from "./types";

const persons: PersonKey[] = ["dome", "emely"];

function task(allowedPersons: EngineTask["allowedPersons"]): EngineTask {
  return { id: "t1", allowedPersons, outdoor: false, effort: 1 };
}

describe("filterByPerson", () => {
  it("returns all candidates for 'both'", () => {
    expect(filterByPerson(task("both"), persons)).toEqual(["dome", "emely"]);
  });

  it("returns only 'dome' for 'dome'", () => {
    expect(filterByPerson(task("dome"), persons)).toEqual(["dome"]);
  });

  it("returns only 'emely' for 'emely'", () => {
    expect(filterByPerson(task("emely"), persons)).toEqual(["emely"]);
  });
});
