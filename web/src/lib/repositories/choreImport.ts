import { PrismaClient } from "@/generated/prisma/client";

import { buildChoreTasks } from "@/lib/services/chores";

type Summary = { created: number; updated: number };

const PEOPLE = [
  { key: "dome", name: "Dome", role: "adult", colorAccent: "teal" },
  { key: "emely", name: "Emely", role: "adult", colorAccent: "coral" },
  { key: "baby", name: "Baby", role: "baby", colorAccent: "neutral" },
] as const;

/** Creates the three household members if they are missing (idempotent). */
async function ensurePeople(client: PrismaClient): Promise<void> {
  for (const person of PEOPLE) {
    const existing = await client.person.findFirst({ where: { key: person.key } });
    if (!existing) {
      await client.person.create({ data: { ...person } });
    }
  }
}

/**
 * Imports the static chore catalogue into the Task table, anchored at `today`.
 * Upserts by `Task.title` (which is not unique, so we match the first row):
 * - missing title  -> create (open, unassigned, staggered dueDate)
 * - existing title -> update definition fields only; dueDate/status/assignedToId
 *   are left untouched so live progress is preserved.
 * Idempotent and non-destructive (touches no other tasks/tables).
 */
export async function importChores(client: PrismaClient, today: Date): Promise<Summary> {
  await ensurePeople(client);

  const summary: Summary = { created: 0, updated: 0 };

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
      await client.task.update({ where: { id: existing.id }, data: definition });
      summary.updated += 1;
    } else {
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
  }

  return summary;
}
