import type { Balances, PersonKey } from "./types";

const PERSON_ORDER: PersonKey[] = ["dome", "emely"];

/** Each person's actual share of the total points, in percent. 0/0 if the total is 0. */
export function computeShare(balances: Balances): Record<PersonKey, number> {
  const total = balances.dome + balances.emely;
  if (total === 0) return { dome: 0, emely: 0 };

  return {
    dome: (balances.dome / total) * 100,
    emely: (balances.emely / total) * 100,
  };
}

/**
 * Picks the candidate with the greatest deficit (target share minus actual share),
 * i.e. the person most behind their fairness target. Ties broken by higher target,
 * then by `PERSON_ORDER`.
 */
export function selectByFairness(
  persons: PersonKey[],
  balances: Balances,
  target: Record<PersonKey, number>,
): PersonKey {
  if (persons.length === 1) return persons[0];

  const actual = computeShare(balances);

  return [...persons].sort((a, b) => {
    const deficitA = target[a] - actual[a];
    const deficitB = target[b] - actual[b];
    if (deficitA !== deficitB) return deficitB - deficitA;

    if (target[a] !== target[b]) return target[b] - target[a];

    return PERSON_ORDER.indexOf(a) - PERSON_ORDER.indexOf(b);
  })[0];
}
