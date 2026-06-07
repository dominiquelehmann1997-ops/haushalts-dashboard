// Repository for projects (groupings of subtasks), e.g. "Babyzimmer einrichten".

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";

export interface ProjectProgress {
  title: string;
  icon: string | null;
  done: number;
  total: number;
  pct: number;
}

/**
 * Progress summary for the (first) project: counts of done/total subtasks and
 * the rounded completion percentage. Returns `null` if there is no project.
 */
export async function getActiveProjectProgress(
  client: PrismaClient = prisma,
): Promise<ProjectProgress | null> {
  const project = await client.project.findFirst({
    include: { tasks: true },
    orderBy: { id: "asc" },
  });
  if (!project) return null;

  const total = project.tasks.length;
  const done = project.tasks.filter((task) => task.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    title: project.title,
    icon: project.icon,
    done,
    total,
    pct,
  };
}
