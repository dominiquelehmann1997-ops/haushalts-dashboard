import { filterByAvailability } from "./availability";
import { selectByFairness } from "./fairness";
import { filterByPerson } from "./personFilter";
import type { PersonKey, PlanInput, PlanResult } from "./types";
import { checkWeather } from "./weatherCheck";

/** Ab diesem Tages-Belegungsanteil gilt eine Person als ganztägig blockiert. */
const FULL_THRESHOLD = 0.8;

/**
 * Plans a single task: filters candidates by who's allowed, defers if outdoor
 * weather doesn't permit it, filters by availability, removes anyone whose day
 * is fully booked (`dayLoad ≥ FULL_THRESHOLD`), then picks the fairest
 * remaining candidate — biased away from partially-busy people via `dayLoad`.
 */
export function planTask(input: PlanInput): PlanResult {
  const { task, day, window, persons, busy, forecast, phase, balances, dayLoad } = input;

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

  const free = dayLoad
    ? available.filter((p: PersonKey) => (dayLoad[p] ?? 0) < FULL_THRESHOLD)
    : available;
  if (free.length === 0) {
    return { kind: "unassignable", reason: "ganztägig belegt" };
  }

  const person = selectByFairness(free, balances, phase.target, dayLoad);
  return { kind: "assigned", person, day };
}
