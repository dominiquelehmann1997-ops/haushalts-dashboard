"use server";

// Thin Server Action wrapper around the accounts repository — books a manual
// "Konto" entry (Nachtrag/Betreuung), then revalidates the dashboard.

import { revalidateDashboard } from "@/lib/revalidate";

import { addManualEntry } from "@/lib/repositories/accounts";

export async function addManualEntryAction(input: {
  personKey: "dome" | "emely";
  label: string;
  points: number;
  source: "nachtrag" | "betreuung";
}): Promise<void> {
  await addManualEntry(input);
  revalidateDashboard();
}
