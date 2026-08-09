// Recurrence service: computes the next due date for a recurring task's
// rhythm, and generates the next open occurrence once a routine is done.

import { prisma } from "@/lib/db";
import { PrismaClient, Task } from "@/generated/prisma/client";
import { learnedInterval } from "@/lib/services/learnedInterval";
import { parseCustomRhythm } from "@/lib/rhythm";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;

/** Real completion gaps (in days) for a routine chain, oldest → newest. */
async function chainCompletionGaps(chainId: string, client: PrismaClient): Promise<number[]> {
  const done = await client.task.findMany({
    where: {
      OR: [{ recurringParentId: chainId }, { id: chainId }],
      status: "done",
      completedAt: { not: null },
    },
    orderBy: { completedAt: "asc" },
    select: { completedAt: true },
  });
  const gaps: number[] = [];
  for (let i = 1; i < done.length; i++) {
    const prev = done[i - 1]!.completedAt!.getTime();
    const cur = done[i]!.completedAt!.getTime();
    gaps.push((cur - prev) / DAY_MS_LOCAL);
  }
  return gaps;
}

/** Per-rhythm offsets in days. Unknown rhythms default to weekly (+7 days). */
const RHYTHM_OFFSET_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  "2x-week": 3,
  "3-day": 3,
  "5-day": 5,
};

/** Rhythms advanced by whole calendar months (no day-count drift). */
const RHYTHM_MONTHS: Record<string, number> = {
  monthly: 1,
  halfyearly: 6,
};

const DEFAULT_OFFSET_DAYS = 7;

/**
 * Tagesabstand eines tagesbasierten Rhythmus: erst die Presets, dann freie
 * Intervalle ("10-day" → 10, siehe `@/lib/rhythm`), sonst der Wochen-Fallback.
 * Monatsrhythmen laufen NICHT hierüber — die rechnet `nextDueDate` kalendarisch.
 */
function dayOffsetFor(rhythm: string): number {
  const preset = RHYTHM_OFFSET_DAYS[rhythm];
  if (preset !== undefined) return preset;

  const custom = parseCustomRhythm(rhythm);
  if (custom !== null) return custom;

  return DEFAULT_OFFSET_DAYS;
}

/**
 * Rhythmen, die eine harte Zusage sind und NIE vom Lernen aufgeweicht werden.
 *
 * "daily" heißt jeden Tag — bei "Gassi gehen" hängt ein Hund daran, nicht eine
 * Statistik. Das Lernen (`@/lib/services/learnedInterval`) ist für Aufgaben
 * gedacht, deren nötiger Takt sich erst im Alltag zeigt (putzen, waschen), und
 * würde hier nur nachlässige Wochen zementieren.
 */
const FIXED_RHYTHMS = new Set(["daily"]);

/**
 * `true`, wenn `rhythm` nicht gelernt werden darf. Neben "daily" zählt auch ein
 * freies Ein-Tages-Intervall ("1-day") dazu — es bedeutet dasselbe und soll
 * nicht über den Umweg der Custom-Eingabe doch aufgeweicht werden.
 */
function isFixedRhythm(rhythm: string): boolean {
  return FIXED_RHYTHMS.has(rhythm) || dayOffsetFor(rhythm) === 1;
}

/**
 * Der konfigurierte Abstand in Tagen — Bezugsgröße für Ausreißer-Filter und
 * Deckel des gelernten Intervalls. Monatsrhythmen werden mit 30 Tagen je Monat
 * genähert; das ist nur für diese beiden Schwellen relevant, der tatsächliche
 * Termin läuft weiter über `nextDueDate`'s kalendergenaues `setMonth`.
 */
function configuredIntervalDays(rhythm: string): number {
  const months = RHYTHM_MONTHS[rhythm];
  if (months !== undefined) return months * 30;
  return dayOffsetFor(rhythm);
}

/**
 * Returns a *new* `Date` advanced from `from` by the offset for `rhythm`.
 * Day-based rhythms (`daily`/`weekly`/`biweekly`/`2x-week`/`3-day`/`5-day`
 * sowie freie `"${n}-day"`-Intervalle) add a fixed number of days; month-based
 * rhythms (`monthly`/`halfyearly`) advance whole calendar months via `setMonth`
 * (so 12th -> 12th, no drift). Unknown/unsupported rhythms default to +7 days
 * (weekly).
 *
 * Note: `setMonth` rolls over for shorter months (31 Jan + 1 month -> 3 Mar);
 * acceptable for household chores.
 *
 * Pure — does not mutate `from`, has no DB dependency.
 */
export function nextDueDate(rhythm: string, from: Date): Date {
  const months = RHYTHM_MONTHS[rhythm];
  if (months !== undefined) {
    const result = new Date(from);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  return new Date(from.getTime() + dayOffsetFor(rhythm) * DAY_MS);
}

/**
 * Generates the next open occurrence of a finished routine task, or `null` when:
 * - the task isn't a `"routine"` with a non-empty `rhythm`, or
 * - the task is neither `"done"` noch `"failed"`, or
 * - a successor already exists (an open Task sharing the recurrence chain
 *   with a later `dueDate`) — preventing duplicates on repeated calls.
 *
 * The successor copies the routine's plan-relevant fields, resets
 * `assignedToId = null` (so the engine can re-plan it fairly), and is linked
 * via `recurringParentId = task.recurringParentId ?? task.id`.
 *
 * Der Termin kommt aus dem gelernten Intervall, sofern es eins gibt — gedeckelt
 * und um Urlaubslücken bereinigt (`@/lib/services/learnedInterval`). Rhythmen
 * aus `FIXED_RHYTHMS` (aktuell "daily") überspringen das Lernen komplett und
 * folgen strikt `nextDueDate`.
 */
export async function generateNextOccurrence(
  taskId: string,
  client: PrismaClient = prisma,
): Promise<Task | null> {
  const task = await client.task.findUnique({ where: { id: taskId } });
  if (!task) return null;

  // "failed" zählt bewusst mit: eine verpasste Woche beendet keine
  // Haushaltsroutine. Wer "Geht heute nicht" tippt, meint diesen einen Tag —
  // vorher endete die Kette dort für immer, und die Routine verschwand
  // lautlos ("Rasen mähen" war so fünf Wochen weg).
  if (task.type !== "routine" || !task.rhythm) return null;
  if (task.status !== "done" && task.status !== "failed") return null;

  const chainId = task.recurringParentId ?? task.id;

  const existingSuccessor = await client.task.findFirst({
    where: {
      recurringParentId: chainId,
      // "moved" zählt mit — eine verschobene Occurrence ist derselbe Auftrag,
      // sonst entstehen Duplikate in der Kette.
      status: { in: ["open", "moved"] },
      dueDate: { gt: task.dueDate },
    },
  });
  if (existingSuccessor) return null;

  // Interval restart: count from when it was actually done, not the old plan
  // date. Bei "failed" gibt es keine Erledigung (`setTaskStatus` setzt
  // `completedAt` auf null) — dann zählt der Plantag. Der Nachfolger kann
  // dadurch in der Vergangenheit landen; `rollOverdueRoutines` zieht ihn beim
  // nächsten Planungslauf auf heute, wie bei jeder überfälligen Occurrence.
  const base = task.completedAt ?? task.dueDate;

  // Feste Rhythmen fragen die Historie gar nicht erst ab — sie sind gesetzt.
  const learned = isFixedRhythm(task.rhythm)
    ? null
    : learnedInterval(
        await chainCompletionGaps(chainId, client),
        configuredIntervalDays(task.rhythm),
      );

  const nextDue =
    learned != null
      ? new Date(base.getTime() + Math.round(learned) * DAY_MS_LOCAL)
      : nextDueDate(task.rhythm, base);

  return client.task.create({
    data: {
      title: task.title,
      type: task.type,
      effort: task.effort,
      allowedPersons: task.allowedPersons,
      outdoor: task.outdoor,
      weatherCondition: task.weatherCondition,
      icon: task.icon,
      rhythm: task.rhythm,
      projectId: task.projectId,
      assignedToId: null,
      status: "open",
      recurringParentId: chainId,
      dueDate: nextDue,
    },
  });
}

/**
 * Zieht die offene Occurrence der Kette `chainId` auf den Termin, der sich aus
 * `rhythm` ergibt. Gedacht für den Moment, in dem jemand den Rhythmus in der
 * Routinen-Verwaltung ändert: ohne das würde der neue Takt erst ab der nächsten
 * Erledigung greifen und die Änderung wirkte folgenlos.
 *
 * Gerechnet wird ab der letzten echten Erledigung der Kette (sonst ab heute),
 * bewusst über `nextDueDate` und damit OHNE gelerntes Intervall: wer gerade
 * explizit einen Takt einstellt, meint diesen Takt. Das Lernen greift ab der
 * nächsten Erledigung wieder.
 *
 * Angefasst werden nur Zeilen mit `status: "open"` UND ohne Zuweisung:
 * - `"moved"` trägt eine bewusste Verschiebung (Wetter-Defer, manuelles
 *   Schieben) samt Begründung in `note` — die zu überschreiben würde diese
 *   Absicht stillschweigend verwerfen. `rollOverdueRoutines` holt solche Zeilen
 *   am Zieltag ohnehin in den neuen Takt zurück.
 * - Eine bereits zugewiesene Aufgabe steht in jemandes Tagesplan; eine
 *   Einstellungs-Änderung darf sie da nicht herausreißen.
 *
 * Gibt den neuen Termin zurück, oder `null`, wenn keine Zeile betroffen war.
 */
export async function rescheduleOpenOccurrence(
  chainId: string,
  rhythm: string,
  today: Date,
  client: PrismaClient = prisma,
): Promise<Date | null> {
  const lastDone = await client.task.findFirst({
    where: {
      OR: [{ id: chainId }, { recurringParentId: chainId }],
      status: "done",
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  const base = lastDone?.completedAt ?? today;
  let candidate = nextDueDate(rhythm, base);

  // Ein verkürzter Rhythmus darf die Aufgabe höchstens auf heute vorziehen —
  // ein Termin in der Vergangenheit wäre sofort überfällig.
  if (candidate.getTime() < today.getTime()) candidate = new Date(today);

  const { count } = await client.task.updateMany({
    where: {
      OR: [{ id: chainId }, { recurringParentId: chainId }],
      status: "open",
      assignedToId: null,
    },
    data: { dueDate: candidate },
  });

  return count > 0 ? candidate : null;
}
