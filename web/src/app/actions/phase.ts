"use server";

// Thin Server Action wrapper around the phase repository — switches the
// active mode (Normal/Elternzeit) and target split, then revalidates the
// dashboard so the stripe reflects the new state.

import { revalidateDashboard } from "@/lib/revalidate";

import { setActivePhase } from "@/lib/repositories/phase";

export async function setPhaseAction(input: {
  mode: "normal" | "elternzeit";
  targetDome: number;
  targetEmely: number;
  caregiverKey?: string | null;
}): Promise<void> {
  await setActivePhase(input);
  revalidateDashboard();
}
