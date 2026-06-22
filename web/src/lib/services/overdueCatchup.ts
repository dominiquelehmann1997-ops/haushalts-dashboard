// Catch-up für überfällige Routinen: pro Rhythmus-Kette nur die jüngste offene
// Occurrence behalten (ältere löschen), und überfällige auf den Plantag ziehen
// + neu zuweisbar machen. Wird vor `planDueTasks` aufgerufen, damit Rückstand
// nicht unsichtbar in der Vergangenheit festhängt.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { dayBounds } from "@/lib/dates";

export async function rollOverdueRoutines(
  day: Date,
  client: PrismaClient = prisma,
): Promise<{ deletedDuplicates: number; rolled: number }> {
  const { start } = dayBounds(day);

  const open = await client.task.findMany({
    where: {
      projectId: null,
      status: "open",
      type: "routine",
      rhythm: { not: null },
    },
    orderBy: { dueDate: "asc" },
  });

  // Nach Rhythmus-Kette gruppieren (recurringParentId ?? id).
  const chains = new Map<string, typeof open>();
  for (const task of open) {
    const chainId = task.recurringParentId ?? task.id;
    const list = chains.get(chainId) ?? [];
    list.push(task);
    chains.set(chainId, list);
  }

  let deletedDuplicates = 0;
  let rolled = 0;

  for (const list of chains.values()) {
    // Jüngste (spätestes dueDate) behalten, ältere offene löschen.
    list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const keep = list[list.length - 1]!;
    const drop = list.slice(0, -1);

    for (const dupe of drop) {
      await client.task.delete({ where: { id: dupe.id } });
      deletedDuplicates += 1;
    }

    // Überfällige behaltene Occurrence auf den Plantag ziehen.
    if (keep.dueDate < start) {
      await client.task.update({
        where: { id: keep.id },
        data: { dueDate: start, assignedToId: null },
      });
      rolled += 1;
    }
  }

  return { deletedDuplicates, rolled };
}
