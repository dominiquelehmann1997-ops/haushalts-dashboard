// Static household-chore catalogue + a pure mapping to Task-creation data.
// Source of truth: docs/superpowers/specs/2026-06-12-tablet-betrieb-chore-import-design.md
// No DB access here — `buildChoreTasks` is pure and deterministic.

export type ChoreInput = {
  title: string;
  type: "routine" | "shopping";
  rhythm: string | null; // null = no auto-recurrence (shopping)
  effort: number; // minutes
  allowedPersons: "both" | "dome" | "emely";
  outdoor: boolean;
  weatherCondition: string | null; // JSON string e.g. '{"noRain":true}'
  icon: string;
  note: string | null;
  sub: string | null;
};

export type ChoreTaskData = ChoreInput & { dueDate: Date };

const NO_RAIN = '{"noRain":true}';

/** The 17 real household chores (Spec 2026-06-12). Order defines the stagger. */
export const CHORES: ChoreInput[] = [
  { title: "Saugroboter starten", type: "routine", rhythm: "daily", effort: 2, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🤖", note: null, sub: null },
  { title: "Bad putzen (groß)", type: "routine", rhythm: "weekly", effort: 30, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🛁", note: null, sub: "groß" },
  { title: "Bad putzen (klein)", type: "routine", rhythm: "weekly", effort: 15, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🚽", note: null, sub: "klein" },
  { title: "Treppe saugen", type: "routine", rhythm: "3-day", effort: 5, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🧹", note: null, sub: null },
  { title: "Rasen mähen", type: "routine", rhythm: "weekly", effort: 60, allowedPersons: "dome", outdoor: true, weatherCondition: NO_RAIN, icon: "🌱", note: null, sub: "nur Dome · Outdoor" },
  { title: "Wäsche waschen", type: "routine", rhythm: "5-day", effort: 20, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🧺", note: "alle 5 Tage kontrollieren", sub: null },
  { title: "Küchenfronten putzen", type: "routine", rhythm: "monthly", effort: 30, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🧽", note: null, sub: null },
  { title: "Sofa und Teppich absaugen", type: "routine", rhythm: "3-day", effort: 10, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🛋️", note: null, sub: null },
  { title: "Staub wischen", type: "routine", rhythm: "weekly", effort: 20, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🪶", note: null, sub: null },
  { title: "Monty bürsten", type: "routine", rhythm: "weekly", effort: 15, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🐕", note: null, sub: null },
  { title: "Gassi gehen", type: "routine", rhythm: "daily", effort: 45, allowedPersons: "both", outdoor: true, weatherCondition: null, icon: "🦮", note: "möglichst vor Spätdienst", sub: null },
  { title: "Einkaufen", type: "shopping", rhythm: null, effort: 50, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🛒", note: "nach Bedarf", sub: null },
  { title: "Hundefutter kaufen", type: "shopping", rhythm: null, effort: 5, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🦴", note: "nach Verbrauch (Vorrats-Rechner später)", sub: null },
  { title: "Kühlschrank ausmisten und wischen", type: "routine", rhythm: "monthly", effort: 60, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🧊", note: null, sub: null },
  { title: "Altglas wegbringen", type: "routine", rhythm: "biweekly", effort: 10, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "♻️", note: null, sub: null },
  { title: "Pfand wegbringen", type: "routine", rhythm: "biweekly", effort: 1, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🥤", note: "mit Einkauf verbinden", sub: null },
  { title: "Fenster putzen", type: "routine", rhythm: "halfyearly", effort: 90, allowedPersons: "both", outdoor: true, weatherCondition: NO_RAIN, icon: "🪟", note: "oben + unten aufteilen, je ≥1,5h/Geschoss", sub: null },
];

/** Returns a *new* Date at `date + days`, preserving the time-of-day. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Spread window (days) used to stagger initial due dates so not every chore
 * is due on day one. Short rhythms keep their own window; weekly and longer
 * (incl. month rhythms) spread over a week; no-rhythm chores are due today.
 */
function staggerWindow(rhythm: string | null): number {
  switch (rhythm) {
    case null:
      return 1; // index % 1 === 0 -> due today
    case "daily":
      return 1;
    case "3-day":
      return 3;
    case "5-day":
      return 5;
    default:
      return 7; // weekly, biweekly, monthly, halfyearly
  }
}

/**
 * Maps the static `CHORES` to Task-creation data with deterministically
 * staggered `dueDate`s anchored at `today`. Pure — no mutation, no DB.
 * `dueDate = today + (index % staggerWindow(rhythm))`.
 */
export function buildChoreTasks(today: Date): ChoreTaskData[] {
  return CHORES.map((chore, index) => ({
    ...chore,
    dueDate: addDays(today, index % staggerWindow(chore.rhythm)),
  }));
}
