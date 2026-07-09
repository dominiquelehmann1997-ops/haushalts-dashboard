"use server";

// Server Actions für den Einstellungen-Reiter (Handy). Dünne Wrapper um das
// Tasks-Repository — mutieren und danach das Dashboard revalidieren, damit
// geänderte Aufgaben-Dauern/Rhythmen sofort in allen Ansichten greifen.

import { revalidateDashboard } from "@/lib/revalidate";
import {
  updateRoutineTemplate,
  type AllowedPersons,
  type UpdateRoutineTemplateInput,
} from "@/lib/repositories/tasks";

export interface UpdateRoutineInput {
  chainId: string;
  effort: number;
  rhythm: string | null;
  allowedPersons: AllowedPersons;
}

/** Ändert Dauer/Rhythmus/Zuständigkeit einer wiederkehrenden Aufgabe dauerhaft. */
export async function updateRoutineTemplateAction(input: UpdateRoutineInput): Promise<void> {
  const patch: UpdateRoutineTemplateInput = {
    effort: input.effort,
    rhythm: input.rhythm,
    allowedPersons: input.allowedPersons,
  };
  await updateRoutineTemplate(input.chainId, patch);
  revalidateDashboard();
}
