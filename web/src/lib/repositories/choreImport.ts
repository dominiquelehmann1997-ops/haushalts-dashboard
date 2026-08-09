// Repository for importing the static household-chore catalogue into Task rows.
import { PrismaClient } from "@/generated/prisma/client";

import { buildChoreTasks } from "@/lib/services/chores";

type Summary = { created: number; skipped: number };

const PEOPLE = [
  { key: "dome", name: "Dome", role: "adult", colorAccent: "teal" },
  { key: "emely", name: "Emely", role: "adult", colorAccent: "coral" },
  { key: "baby", name: "Baby", role: "baby", colorAccent: "neutral" },
] as const;

/** Creates the three household members if they are missing (idempotent). */
async function ensurePeople(client: PrismaClient): Promise<void> {
  for (const person of PEOPLE) {
    const existing = await client.person.findUnique({ where: { key: person.key } });
    if (!existing) {
      await client.person.create({ data: { ...person } });
    }
  }
}

/**
 * Legt den statischen Chore-Katalog als Task-Zeilen an, verankert an `today`.
 * Erstanlage-Werkzeug, kein Abgleich: gematcht wird über `Task.title` (nicht
 * unique, es zählt die erste Zeile), und
 * - unbekannter Titel -> anlegen (offen, unzugewiesen, gestaffeltes dueDate)
 * - bekannter Titel   -> überspringen.
 *
 * Bewusst KEIN Update mehr: Dauer, Rhythmus, Zuständigkeit und Wetter werden
 * seit der Routinen-Verwaltung (`/mobile/routines`) in der App gepflegt. Ein
 * Import, der den Katalog drüberschreibt, würde genau diese Eingaben
 * stillschweigend zurücksetzen — die DB ist ab dem Erst-Import die Wahrheit.
 *
 * Zwei Folgen, die dazugehören:
 * - Eine über die App beendete Katalog-Routine wird durch einen erneuten Import
 *   nicht wiederbelebt, solange erledigte Zeilen mit dem Titel existieren.
 * - Eine umbenannte Routine legt der Import unter dem alten Katalogtitel neu an.
 *   Der Import ist Bootstrap, im laufenden Betrieb nicht erneut ausführen.
 *
 * Takes an explicit `client` (no `= prisma` default) on purpose: the standalone
 * CLI (`prisma/importChores.ts`) and the tests pass their own PrismaClient, so
 * this repo never imports the `@/lib/db` singleton.
 */
export async function importChores(client: PrismaClient, today: Date): Promise<Summary> {
  await ensurePeople(client);

  const summary: Summary = { created: 0, skipped: 0 };

  for (const chore of buildChoreTasks(today)) {
    const definition = {
      type: chore.type,
      rhythm: chore.rhythm,
      effort: chore.effort,
      allowedPersons: chore.allowedPersons,
      outdoor: chore.outdoor,
      weatherCondition: chore.weatherCondition,
      icon: chore.icon,
      note: chore.note,
      sub: chore.sub,
    };

    const existing = await client.task.findFirst({ where: { title: chore.title } });

    if (existing) {
      summary.skipped += 1;
      continue;
    }

    await client.task.create({
      data: {
        title: chore.title,
        ...definition,
        status: "open",
        assignedToId: null,
        dueDate: chore.dueDate,
      },
    });
    summary.created += 1;
  }

  return summary;
}
