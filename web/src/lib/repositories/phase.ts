// Repository for the active "Phase" configuration (normal vs. Elternzeit).

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";

export interface ActivePhase {
  mode: string;
  targetDome: number;
  targetEmely: number;
  caregiverKey: string | null;
}

/** Returns the currently active `PhaseSetting`, or `null` if none is active. */
export async function getActivePhase(client: PrismaClient = prisma): Promise<ActivePhase | null> {
  const phase = await client.phaseSetting.findFirst({ where: { isActive: true } });
  if (!phase) return null;

  return {
    mode: phase.mode,
    targetDome: phase.targetDome,
    targetEmely: phase.targetEmely,
    caregiverKey: phase.caregiverKey,
  };
}
