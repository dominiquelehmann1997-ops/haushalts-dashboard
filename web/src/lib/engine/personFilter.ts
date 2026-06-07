import type { EngineTask, PersonKey } from "./types";

/** Returns the subset of `persons` allowed to perform `task`. */
export function filterByPerson(task: EngineTask, persons: PersonKey[]): PersonKey[] {
  if (task.allowedPersons === "both") return persons;
  return persons.filter((p) => p === task.allowedPersons);
}
