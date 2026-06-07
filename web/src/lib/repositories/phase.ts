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

/**
 * Updates the currently active `PhaseSetting` (mode, target split, caregiver).
 * If none is active yet, creates a fresh one (`activeFrom = now`, `isActive: true`).
 */
export async function setActivePhase(
  input: {
    mode: "normal" | "elternzeit";
    targetDome: number;
    targetEmely: number;
    caregiverKey?: string | null;
  },
  client: PrismaClient = prisma,
): Promise<void> {
  const current = await client.phaseSetting.findFirst({ where: { isActive: true } });

  if (current) {
    await client.phaseSetting.update({
      where: { id: current.id },
      data: {
        mode: input.mode,
        targetDome: input.targetDome,
        targetEmely: input.targetEmely,
        caregiverKey: input.caregiverKey ?? null,
      },
    });
    return;
  }

  await client.phaseSetting.create({
    data: {
      mode: input.mode,
      targetDome: input.targetDome,
      targetEmely: input.targetEmely,
      caregiverKey: input.caregiverKey ?? null,
      activeFrom: new Date(),
      isActive: true,
    },
  });
}
