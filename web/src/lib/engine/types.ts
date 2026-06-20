// Pure type contract for the Fairness-Konto distribution engine.
// No imports from db/repositories/integrations/next/prisma — see engine README in the spec.

export type PersonKey = "dome" | "emely";

export interface EngineTask {
  id: string;
  allowedPersons: "both" | "dome" | "emely";
  outdoor: boolean;
  weatherCondition?: { noRain: boolean; minTemp?: number };
  effort: number;
}

export interface BusyWindow {
  person: PersonKey;
  start: Date;
  end: Date;
}

// rainWindows are local "HH:MM"–"HH:MM" intervals on that date.
export interface DayForecast {
  date: string; // "YYYY-MM-DD"
  rainWindows: { from: string; to: string }[];
  minTemp: number;
  maxTemp: number;
}

export interface PhaseConfig {
  mode: "normal" | "elternzeit";
  target: Record<PersonKey, number>; // desired work share in %, e.g. {dome:60, emely:40}
  caregiver?: PersonKey;
}

export type Balances = Record<PersonKey, number>;

export interface PlanInput {
  task: EngineTask;
  day: Date; // the planned day
  window?: { start: Date; end: Date }; // task time window (for availability + weather overlap)
  persons: PersonKey[]; // candidate pool, usually ["dome","emely"]
  busy: BusyWindow[];
  forecast: DayForecast[]; // forecast for `day` and following days
  phase: PhaseConfig;
  balances: Balances;
  /**
   * Belegungsanteil 0…1 pro Person für `day` (aus `@/lib/engine/capacity`'s
   * `dayLoad`, vom Caller injiziert). `≥ 0.8` → Person an dem Tag gesperrt;
   * sonst dämpft der Wert die Fairness-Auswahl. Fehlt das Feld, wirkt keine
   * Kapazitäts-Logik (Alt-Verhalten).
   */
  dayLoad?: Record<PersonKey, number>;
}

export type PlanResult =
  | { kind: "assigned"; person: PersonKey; day: Date }
  | { kind: "deferred"; reason: string; suggestedDay: Date }
  | { kind: "unassignable"; reason: string };
