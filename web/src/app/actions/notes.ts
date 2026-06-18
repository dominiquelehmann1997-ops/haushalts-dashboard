"use server";

import { revalidateDashboard } from "@/lib/revalidate";
import { createNote, updateNote, deleteNote, togglePinNote } from "@/lib/repositories/notes";

export async function createNoteAction(input: { text: string; icon?: string | null; pinned?: boolean }): Promise<void> {
  await createNote(input);
  revalidateDashboard();
}

export async function updateNoteAction(
  id: string,
  input: { text?: string; icon?: string | null; pinned?: boolean },
): Promise<void> {
  await updateNote(id, input);
  revalidateDashboard();
}

export async function deleteNoteAction(id: string): Promise<void> {
  await deleteNote(id);
  revalidateDashboard();
}

export async function togglePinNoteAction(id: string): Promise<void> {
  await togglePinNote(id);
  revalidateDashboard();
}
