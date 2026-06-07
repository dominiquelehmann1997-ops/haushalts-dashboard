// Shared UI-facing domain types / DTOs.
//
// These restate the shapes already used by the UI (see `./data.ts`) in one
// central place so that later phases can map DB rows onto exactly what the
// existing components expect, without changing how anything looks.
//
// Do not modify `data.ts` — these types intentionally mirror it.

export type PersonKey = "dome" | "emely" | "baby";

export type TaskStatus = "open" | "done" | "moved" | "failed";

export interface Task {
  id: string;
  person: "dome" | "emely";
  text: string;
  mins: number | null;
  status: TaskStatus;
  icon: string;
  note?: string;
  sub?: string;
}

export interface Appointment {
  id: string;
  time: string;
  title: string;
  place: string;
  who: PersonKey[];
}

export interface ShoppingItem {
  id: string;
  text: string;
  meal: boolean;
  done: boolean;
}

export interface Meal {
  day: string;
  dish: string;
  today: boolean;
  light?: boolean;
}

export interface Note {
  id: string;
  icon: string;
  text: string;
}

export interface PersonStyle {
  name: string;
  dot: string;
  text: string;
  ring: string;
  soft: string;
  fill: string;
}
