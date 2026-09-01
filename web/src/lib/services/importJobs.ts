// Zustand laufender Rezept-Importe. Bewusst nur im Speicher: ein Import lebt
// eine Minute, danach ist der Eintrag wertlos. Eine Tabelle dafür hieße eine
// Migration auf dem Android-Tablet für Wegwerfdaten.
//
// Das trägt, weil `next start` EIN Prozess ist. Liefe das Dashboard je mit
// mehreren Workern, landeten Start und Abfrage in verschiedenen Prozessen und
// dieser Ansatz bricht — dann muss der Zustand in die DB.

import type { ImportedRecipe } from "@/lib/services/recipeImport";

export type ImportJob =
  | { status: "pending" }
  | { status: "done"; recipe: ImportedRecipe }
  | { status: "error"; error: string };

/** Nach dieser Zeit wird ein Job vergessen, fertig oder nicht. */
export const JOB_TTL_MS = 600_000;

const jobs = new Map<string, { job: ImportJob; createdAt: number }>();

/**
 * Aufräumen beim Zugriff statt per Timer: ein `setInterval` im Modul-Scope
 * überlebt Hot-Reloads schlecht und hält den Prozess wach.
 */
function sweep(now: number): void {
  for (const [id, entry] of jobs) {
    if (now - entry.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function createJob(): string {
  const now = Date.now();
  sweep(now);
  const id = crypto.randomUUID();
  jobs.set(id, { job: { status: "pending" }, createdAt: now });
  return id;
}

/**
 * Der Job wird beim Lesen NICHT gelöscht: die App könnte die Antwort verlieren
 * und erneut fragen. Die TTL räumt auf.
 */
export function readJob(id: string): ImportJob | null {
  sweep(Date.now());
  return jobs.get(id)?.job ?? null;
}

/** Ergebnisse für abgelaufene oder unbekannte Jobs fallen still unter den Tisch. */
function settle(id: string, job: ImportJob): void {
  const entry = jobs.get(id);
  if (entry) entry.job = job;
}

export function finishJob(id: string, recipe: ImportedRecipe): void {
  settle(id, { status: "done", recipe });
}

export function failJob(id: string, error: string): void {
  settle(id, { status: "error", error });
}

/** Nur für Tests. */
export function __resetJobsForTest(): void {
  jobs.clear();
}
