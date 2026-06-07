import { filterByAvailability } from "./availability";
import { selectByFairness } from "./fairness";
import { filterByPerson } from "./personFilter";
import type { PlanInput, PlanResult } from "./types";
import { checkWeather } from "./weatherCheck";

/**
 * Plans a single task: filters candidates by who's allowed, defers if outdoor
 * weather doesn't permit it, filters by availability, then picks the fairest
 * candidate by their deficit against the phase's target work split.
 */
export function planTask(input: PlanInput): PlanResult {
  const { task, day, window, persons, busy, forecast, phase, balances } = input;

  const candidates = filterByPerson(task, persons);
  if (candidates.length === 0) {
    return { kind: "unassignable", reason: "niemand erlaubt" };
  }

  if (task.outdoor) {
    const weather = checkWeather(task, day, forecast, window);
    if (!weather.ok) {
      return { kind: "deferred", reason: weather.reason, suggestedDay: weather.suggestedDay };
    }
  }

  const available = filterByAvailability(candidates, window, busy);
  if (available.length === 0) {
    return { kind: "unassignable", reason: "niemand verfügbar" };
  }

  const person = selectByFairness(available, balances, phase.target);
  return { kind: "assigned", person, day };
}
