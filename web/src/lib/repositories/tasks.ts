// Repository for standalone tasks (routines/todos) shown in person/day views.
//
// "Standalone" = `projectId == null`. Project subtasks are excluded here —
// they're surfaced via `projects.ts` instead.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Task, TaskStatus } from "@/lib/domain";
import type { PersonKey } from "@/lib/engine/types";
import { dayBounds } from "@/lib/dates";
import { recordCompletion } from "@/lib/engine/completion";
import { nextSensibleDay } from "@/lib/services/taskDefer";
import { generateNextOccurrence, rescheduleOpenOccurrence } from "@/lib/services/recurrence";
import { isValidRhythm } from "@/lib/rhythm";

type TaskRow = {
  id: string;
  title: string;
  effort: number;
  status: string;
  icon: string | null;
  note: string | null;
  sub: string | null;
  assignedTo: { key: string } | null;
};

/** Maps a Prisma `Task` row (with `assignedTo` included) onto the domain `Task` DTO. */
function toDomainTask(row: TaskRow): Task {
  return {
    id: row.id,
    person: row.assignedTo?.key as "dome" | "emely",
    text: row.title,
    mins: row.effort,
    status: row.status as TaskStatus,
    icon: row.icon ?? "",
    note: row.note ?? undefined,
    sub: row.sub ?? undefined,
  };
}

/**
 * Standalone tasks (`projectId == null`) assigned to `personKey` whose
 * `dueDate` falls on the given local day.
 */
export async function getTasksByPerson(
  personKey: "dome" | "emely",
  date: Date,
  client: PrismaClient = prisma,
): Promise<Task[]> {
  const { start, end } = dayBounds(date);

  const rows = await client.task.findMany({
    where: {
      projectId: null,
      dueDate: { gte: start, lte: end },
      assignedTo: { key: personKey },
    },
    include: { assignedTo: true },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(toDomainTask);
}

/** Standalone tasks (both persons) whose `dueDate` falls on the given local day. */
export async function getTasksForDay(date: Date, client: PrismaClient = prisma): Promise<Task[]> {
  const { start, end } = dayBounds(date);

  const rows = await client.task.findMany({
    where: {
      projectId: null,
      dueDate: { gte: start, lte: end },
    },
    include: { assignedTo: true },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(toDomainTask);
}

/** Count of standalone tasks (`projectId == null`) with `status === "open"`. */
export async function getOpenTaskCount(client: PrismaClient = prisma): Promise<number> {
  return client.task.count({
    where: {
      projectId: null,
      status: "open",
    },
  });
}

/**
 * Updates a task's `status` (+ `reason`, `completedAt`) and recomputes its
 * "planned" booking from scratch — making any status transition idempotent:
 *
 * 1. Delete any existing `AccountEntry` for this task with `source: "planned"`.
 * 2. If the new status is `"done"`, reload the task (with `assignedTo`) and run
 *    it through the engine's `recordCompletion`; if it returns an entry, create
 *    the corresponding `AccountEntry` (resolving `personId` from `personKey`,
 *    `occurredAt = now`).
 *
 * Keeps the booking logic single-sourced in the engine — no duplicated points math.
 */
export async function setTaskStatus(
  id: string,
  status: TaskStatus,
  reason: string | null,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.task.update({
    where: { id },
    data: {
      status,
      reason,
      completedAt: status === "done" ? new Date() : null,
    },
  });

  // Recompute the "planned" booking from scratch — idempotent for any transition.
  await client.accountEntry.deleteMany({
    where: { taskId: id, source: "planned" },
  });

  if (status === "done") {
    const task = await client.task.findUniqueOrThrow({
      where: { id },
      include: { assignedTo: true },
    });

    if (task.reason === "both") {
      const domePerson = await client.person.findUniqueOrThrow({ where: { key: "dome" } });
      const emelyPerson = await client.person.findUniqueOrThrow({ where: { key: "emely" } });

      await client.accountEntry.createMany({
        data: [
          {
            personId: domePerson.id,
            label: task.title,
            points: task.effort,
            source: "planned",
            taskId: task.id,
            occurredAt: new Date(),
          },
          {
            personId: emelyPerson.id,
            label: task.title,
            points: task.effort,
            source: "planned",
            taskId: task.id,
            occurredAt: new Date(),
          },
        ],
      });
    } else {
      const assignedKey = task.assignedTo?.key;
      const assignedTo: PersonKey | null =
        assignedKey === "dome" || assignedKey === "emely" ? assignedKey : null;

      const entryInput = recordCompletion({
        id: task.id,
        title: task.title,
        status: "done",
        effort: task.effort,
        assignedTo,
      });

      if (entryInput) {
        const person = await client.person.findUniqueOrThrow({
          where: { key: entryInput.personKey },
        });

        await client.accountEntry.create({
          data: {
            personId: person.id,
            label: entryInput.label,
            points: entryInput.points,
            source: entryInput.source,
            taskId: entryInput.taskId,
            occurredAt: new Date(),
          },
        });
      }
    }
  }

  // Wiederkehrende Routinen legen ihre nächste Occurrence an, sobald die
  // aktuelle abgeschlossen ist — erledigt ODER gescheitert. "Geht heute nicht"
  // beendet die Routine nicht, es überspringt nur diesen Termin. (Idempotent:
  // generateNextOccurrence ignoriert Nicht-Routinen und verhindert Duplikate.)
  if (status === "done" || status === "failed") {
    await generateNextOccurrence(id, client);
  }
}

/** Sets a task's `assignedTo` (resolved by `personKey`) and `dueDate`. */
export async function assignTask(
  id: string,
  personKey: "dome" | "emely",
  day: Date,
  client: PrismaClient = prisma,
): Promise<void> {
  const person = await client.person.findUniqueOrThrow({ where: { key: personKey } });

  await client.task.update({
    where: { id },
    data: {
      assignedToId: person.id,
      dueDate: day,
    },
  });
}

export interface CreateTaskInput {
  title: string;
  type?: string; // default "todo"
  effort: number;
  allowedPersons: "both" | "dome" | "emely";
  dueDate: Date;
  rhythm?: string | null;
  icon?: string | null;
  assignToKey?: "dome" | "emely" | null;
}

/** Creates an open standalone task. Resolves `assignToKey` to a Person id when given. */
export async function createTask(
  input: CreateTaskInput,
  client: PrismaClient = prisma,
): Promise<{ id: string }> {
  let assignedToId: string | null = null;
  if (input.assignToKey) {
    const person = await client.person.findUniqueOrThrow({ where: { key: input.assignToKey } });
    assignedToId = person.id;
  }
  const task = await client.task.create({
    data: {
      title: input.title,
      type: input.type ?? "todo",
      effort: input.effort,
      allowedPersons: input.allowedPersons,
      rhythm: input.rhythm ?? null,
      icon: input.icon ?? null,
      status: "open",
      dueDate: input.dueDate,
      assignedToId,
    },
    select: { id: true },
  });
  return task;
}

export interface OpenTaskDTO {
  id: string;
  title: string;
  icon: string;
  person: "dome" | "emely" | null;
  dueDateISO: string;
  rhythm: string | null;
}

/** All open standalone tasks (incl. not-yet-due), for the "Erledigt nachtragen" picker. */
export async function listOpenTasks(client: PrismaClient = prisma): Promise<OpenTaskDTO[]> {
  const rows = await client.task.findMany({
    where: { projectId: null, status: "open" },
    include: { assignedTo: true },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon ?? "",
    person: r.assignedTo?.key === "dome" || r.assignedTo?.key === "emely" ? r.assignedTo.key : null,
    dueDateISO: r.dueDate.toISOString(),
    rhythm: r.rhythm ?? null,
  }));
}

/**
 * Schließt eine Aufgabe im Namen des *tatsächlichen* Erledigers ab: setzt
 * `assignedToId` auf `doerKey` und ruft dann `setTaskStatus(…, "done")`. Da die
 * Buchung in `setTaskStatus`/`recordCompletion` an `assignedTo` hängt, gehen die
 * Fairness-Punkte an den Erlediger. Recurring spawnt die nächste Occurrence
 * unassigned wie gehabt.
 */
export async function completeTaskBy(
  id: string,
  doerKey: "dome" | "emely",
  client: PrismaClient = prisma,
): Promise<void> {
  const person = await client.person.findUniqueOrThrow({ where: { key: doerKey } });
  await client.task.update({ where: { id }, data: { assignedToId: person.id } });
  await setTaskStatus(id, "done", null, client);
}

/**
 * Schließt eine Aufgabe im Namen von BEIDEN ab: setzt
 * status auf "done" und reason auf "both". setTaskStatus rechnet die Punkte
 * dann beiden Personen an.
 */
export async function completeTaskByBoth(
  id: string,
  client: PrismaClient = prisma,
): Promise<void> {
  await setTaskStatus(id, "done", "both", client);
}

/**
 * Schiebt eine Aufgabe auf den nächsten sinnvollen Tag (Rhythmus, sonst morgen)
 * und markiert sie als `moved`. `note` dokumentiert die Verschiebung in der UI.
 */
export async function deferTask(
  id: string,
  today: Date,
  client: PrismaClient = prisma,
): Promise<void> {
  const task = await client.task.findUniqueOrThrow({ where: { id } });
  const nextDay = nextSensibleDay({ rhythm: task.rhythm }, today);
  await client.task.update({
    where: { id },
    data: {
      status: "moved",
      reason: null,
      dueDate: nextDay,
      note: nextDay.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }),
    },
  });
}

// ─── Routinen-Vorlagen (Routinen-Verwaltung) ────────────────────────────────
//
// Wiederkehrende Routinen bestehen aus einer Kette einzelner Task-Zeilen, die
// über `recurringParentId ?? id` (die "chainId") verbunden sind. Für die
// Verwaltung fassen wir jede Kette zu EINER bearbeitbaren Vorlage zusammen:
// ändert man ein Feld, schreiben wir es auf alle Zeilen der Kette. Neue
// Occurrences erben ihre Werte von der zuletzt erledigten Zeile (siehe
// `generateNextOccurrence`) — deshalb reicht es NICHT, nur die offene Zeile zu
// ändern; erledigt werden kann auch eine ältere (Picker "Erledigt nachtragen").

export type AllowedPersons = "both" | "dome" | "emely";

const ALLOWED_PERSONS: AllowedPersons[] = ["both", "dome", "emely"];

/** Obergrenze für die Dauer einer Aufgabe (24 h in Minuten). */
const MAX_EFFORT_MINUTES = 1440;

const MAX_TITLE_LENGTH = 120;

export interface RoutineTemplateDTO {
  /** `recurringParentId ?? id` der Kette — Ziel für Updates. */
  chainId: string;
  title: string;
  icon: string;
  effort: number;
  rhythm: string | null;
  allowedPersons: AllowedPersons;
  outdoor: boolean;
  /** Roh-JSON wie in der DB, z.B. `{"noRain":true}`. `null` = keine Bedingung. */
  weatherCondition: string | null;
  /** Termin der aktuellsten offenen/verschobenen Zeile der Kette. */
  nextDueISO: string | null;
}

/**
 * Eine Zeile pro *aktiver* wiederkehrender Routine (Kette zusammengefasst),
 * alphabetisch. Repräsentant je Kette ist die zuletzt fällige Zeile — sie trägt
 * die aktuell gültigen Werte.
 *
 * Ausgegeben werden nur Ketten mit mindestens einer offenen oder verschobenen
 * Zeile. Eine lebende Routine hat immer eine: `generateNextOccurrence` legt sie
 * beim Abschließen an — sowohl nach "done" als auch nach "failed". Fehlt sie,
 * wurde die Routine bewusst über `deleteRoutineTemplate` beendet.
 */
export async function listRoutineTemplates(
  client: PrismaClient = prisma,
): Promise<RoutineTemplateDTO[]> {
  const rows = await client.task.findMany({
    where: { type: "routine", projectId: null },
    orderBy: { dueDate: "desc" },
    select: {
      id: true,
      recurringParentId: true,
      title: true,
      icon: true,
      effort: true,
      rhythm: true,
      allowedPersons: true,
      outdoor: true,
      weatherCondition: true,
      status: true,
      dueDate: true,
    },
  });

  const byChain = new Map<string, RoutineTemplateDTO>();
  for (const r of rows) {
    const chainId = r.recurringParentId ?? r.id;

    if (!byChain.has(chainId)) {
      // Erste Begegnung gewinnt = spätestes dueDate (Query ist desc sortiert).
      const allowed: AllowedPersons =
        r.allowedPersons === "dome" || r.allowedPersons === "emely" ? r.allowedPersons : "both";
      byChain.set(chainId, {
        chainId,
        title: r.title,
        icon: r.icon ?? "",
        effort: r.effort,
        rhythm: r.rhythm ?? null,
        allowedPersons: allowed,
        outdoor: r.outdoor,
        weatherCondition: r.weatherCondition ?? null,
        nextDueISO: null,
      });
    }

    // Erste offene/verschobene Zeile der Kette = der nächste echte Termin.
    const entry = byChain.get(chainId)!;
    if (entry.nextDueISO === null && (r.status === "open" || r.status === "moved")) {
      entry.nextDueISO = r.dueDate.toISOString();
    }
  }

  return [...byChain.values()]
    .filter((t) => t.nextDueISO !== null)
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
}

/** Gemeinsame Felder von Anlegen und Bearbeiten, nach der Validierung. */
interface RoutineFields {
  title: string;
  icon: string | null;
  effort: number;
  rhythm: string | null;
  allowedPersons: AllowedPersons;
  outdoor: boolean;
  weatherCondition: string | null;
}

/**
 * Prüft und normalisiert die übergebenen Felder. Nur gesetzte Schlüssel werden
 * betrachtet, damit dieselbe Prüfung für Teil-Updates und fürs Anlegen gilt.
 * Wirft mit deutscher Meldung — die Actions lassen sie zur UI durch.
 */
function validateRoutineFields(patch: Partial<RoutineFields>): Partial<RoutineFields> {
  const out: Partial<RoutineFields> = {};

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (title.length === 0) throw new Error("Titel darf nicht leer sein.");
    if (title.length > MAX_TITLE_LENGTH) {
      throw new Error(`Titel ist zu lang (max. ${MAX_TITLE_LENGTH} Zeichen).`);
    }
    out.title = title;
  }

  if (patch.icon !== undefined) {
    const icon = patch.icon?.trim() ?? "";
    out.icon = icon.length > 0 ? icon : null;
  }

  if (patch.effort !== undefined) {
    const effort = Math.round(patch.effort);
    if (!Number.isFinite(effort) || effort < 0 || effort > MAX_EFFORT_MINUTES) {
      throw new Error(`Ungültige Dauer: ${patch.effort}`);
    }
    out.effort = effort;
  }

  if (patch.rhythm !== undefined) {
    if (patch.rhythm !== null && !isValidRhythm(patch.rhythm)) {
      throw new Error(`Unbekannter Rhythmus: ${patch.rhythm}`);
    }
    out.rhythm = patch.rhythm;
  }

  if (patch.allowedPersons !== undefined) {
    if (!ALLOWED_PERSONS.includes(patch.allowedPersons)) {
      throw new Error(`Ungültige Zuständigkeit: ${patch.allowedPersons}`);
    }
    out.allowedPersons = patch.allowedPersons;
  }

  if (patch.outdoor !== undefined) out.outdoor = patch.outdoor;

  if (patch.weatherCondition !== undefined) {
    out.weatherCondition = normalizeWeatherCondition(patch.weatherCondition);
  }

  // Eine Wetterbedingung ohne `outdoor` ist tote Information: `planTask` prüft
  // das Wetter nur für Outdoor-Aufgaben. Lieber gleich leeren, als sie später
  // wirkungslos mitzuschleppen.
  if (out.outdoor === false) out.weatherCondition = null;

  return out;
}

/**
 * Kanonisiert die Wetterbedingung auf genau das Format, das
 * `@/lib/services/planning`'s `parseWeatherCondition` erwartet:
 * `{"noRain":true}` / `{"minTemp":15}` / beides. Alles andere wirft, statt
 * still als `undefined` zu verpuffen.
 */
function normalizeWeatherCondition(raw: string | null): string | null {
  if (raw === null || raw.trim() === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Ungültige Wetterbedingung: ${raw}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Ungültige Wetterbedingung: ${raw}`);
  }

  const { noRain, minTemp } = parsed as { noRain?: unknown; minTemp?: unknown };
  const out: { noRain?: boolean; minTemp?: number } = {};

  if (noRain !== undefined) {
    if (typeof noRain !== "boolean") throw new Error(`Ungültiges "noRain": ${String(noRain)}`);
    if (noRain) out.noRain = true;
  }
  if (minTemp !== undefined && minTemp !== null) {
    if (typeof minTemp !== "number" || !Number.isFinite(minTemp)) {
      throw new Error(`Ungültiges "minTemp": ${String(minTemp)}`);
    }
    out.minTemp = minTemp;
  }

  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

export type UpdateRoutineTemplatePatch = Partial<RoutineFields>;

/**
 * Schreibt die übergebenen Felder auf ALLE Zeilen der Kette `chainId`, sodass
 * sie auch für künftige Occurrences gelten. Nur gesetzte Felder werden
 * angefasst.
 *
 * Ändert sich dabei der Rhythmus, wird die offene Occurrence sofort umgeplant
 * (`rescheduleOpenOccurrence`) — sonst bliebe eine Intervall-Änderung bis zur
 * nächsten Erledigung wirkungslos.
 */
export async function updateRoutineTemplate(
  chainId: string,
  patch: UpdateRoutineTemplatePatch,
  client: PrismaClient = prisma,
): Promise<void> {
  const data = validateRoutineFields(patch);

  const current = await client.task.findFirst({
    where: { OR: [{ id: chainId }, { recurringParentId: chainId }] },
    orderBy: { dueDate: "desc" },
    select: { rhythm: true },
  });
  if (!current) throw new Error(`Unbekannte Routine: ${chainId}`);

  if (Object.keys(data).length > 0) {
    await client.task.updateMany({
      where: { OR: [{ id: chainId }, { recurringParentId: chainId }] },
      data,
    });
  }

  const rhythmChanged =
    data.rhythm !== undefined && data.rhythm !== null && data.rhythm !== current.rhythm;
  if (rhythmChanged) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await rescheduleOpenOccurrence(chainId, data.rhythm!, today, client);
  }
}

export interface CreateRoutineInput {
  title: string;
  icon: string | null;
  effort: number;
  /** Pflicht — eine Routine ohne Rhythmus wäre ein einmaliges Todo. */
  rhythm: string;
  allowedPersons: AllowedPersons;
  outdoor: boolean;
  weatherCondition: string | null;
}

/**
 * Legt eine neue Routine an: EINE offene, unzugewiesene Zeile, fällig heute.
 * Sie ist die Wurzel ihrer Kette (`recurringParentId: null`, `chainId === id`).
 *
 * Der Planer nimmt sie beim nächsten Lauf auf (er sucht offene, unzugewiesene
 * Aufgaben des Tages), danach trägt `generateNextOccurrence` die Kette weiter.
 */
export async function createRoutineTemplate(
  input: CreateRoutineInput,
  client: PrismaClient = prisma,
): Promise<{ id: string }> {
  const fields = validateRoutineFields(input);
  if (fields.rhythm === null || fields.rhythm === undefined) {
    throw new Error("Eine Routine braucht einen Rhythmus.");
  }

  const dueDate = new Date();
  dueDate.setHours(0, 0, 0, 0);

  const created = await client.task.create({
    data: {
      title: fields.title!,
      type: "routine",
      effort: fields.effort!,
      rhythm: fields.rhythm,
      allowedPersons: fields.allowedPersons!,
      outdoor: fields.outdoor ?? false,
      weatherCondition: fields.weatherCondition ?? null,
      icon: fields.icon ?? null,
      status: "open",
      assignedToId: null,
      recurringParentId: null,
      dueDate,
    },
    select: { id: true },
  });

  return created;
}

/**
 * Beendet eine Routine: löscht die offenen und verschobenen Zeilen der Kette.
 * Erledigte und gescheiterte Zeilen bleiben vollständig erhalten — sie sind
 * Historie und hängen am Fairness-Konto.
 *
 * Danach hat die Kette keine offene Zeile mehr, verschwindet also aus
 * `listRoutineTemplates` und aus dem "Erledigt nachtragen"-Picker. Ein
 * Nachfolger kann nicht mehr entstehen, weil `generateNextOccurrence` nur beim
 * Abschließen einer offenen Zeile feuert.
 *
 * Bewusst KEIN Hard-Delete der ganzen Kette: `AccountEntry.taskId` ist eine
 * echte Relation ohne Cascade — das Löschen erledigter Zeilen liefe entweder in
 * einen FK-Fehler oder würde die Punktehistorie umschreiben.
 *
 * Bekannte Kante: Wird eine bereits erledigte Zeile der beendeten Routine im
 * Aufgaben-Tab zurück- und wieder vorgetoggelt, entsteht ein neuer Nachfolger —
 * die Routine lebt wieder. Selbst ausgelöst, sichtbar, erneut beendbar.
 */
export async function deleteRoutineTemplate(
  chainId: string,
  client: PrismaClient = prisma,
): Promise<{ deleted: number }> {
  const rows = await client.task.findMany({
    where: {
      OR: [{ id: chainId }, { recurringParentId: chainId }],
      status: { in: ["open", "moved"] },
    },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return { deleted: 0 };

  await client.$transaction(async (tx) => {
    // Per Invariante leer: geplante Buchungen entstehen erst beim Erledigen und
    // `setTaskStatus` räumt sie bei jedem Statuswechsel ab. Nur der Randfall
    // done → `deferTask` (räumt nicht auf) könnte eine hinterlassen. Bewusst
    // ausschließlich `source: "planned"` — manuelle Einträge sind Konto-
    // historie und sollen im Fehlerfall laut per FK scheitern.
    await tx.accountEntry.deleteMany({ where: { taskId: { in: ids }, source: "planned" } });
    await tx.task.deleteMany({ where: { id: { in: ids } } });
  });

  return { deleted: ids.length };
}
