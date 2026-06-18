"use server";

// Thin Server Action wrappers around the tasks repository — mutate, then
// revalidate the dashboard so the UI reflects the new state. No business
// logic here: status transitions and bookings are single-sourced in
// `setTaskStatus` (see `@/lib/repositories/tasks`).

import { revalidateDashboard } from "@/lib/revalidate";

import { prisma } from "@/lib/db";
import { deferTask, setTaskStatus, createTask, type CreateTaskInput } from "@/lib/repositories/tasks";

/** Toggles a task between "open" and "done"; other statuses are a no-op. */
export async function toggleTaskAction(id: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({ where: { id } });

  if (task.status === "open") {
    await setTaskStatus(id, "done", null);
  } else if (task.status === "done") {
    await setTaskStatus(id, "open", null);
  }

  revalidateDashboard();
}

/** Schiebt eine Aufgabe auf den nächsten sinnvollen Tag (Status "moved"). */
export async function deferTaskAction(id: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await deferTask(id, today);
  revalidateDashboard();
}

/** Marks a task as "failed" with a reason. */
export async function failTaskAction(id: string, reason: string): Promise<void> {
  await setTaskStatus(id, "failed", reason);
  revalidateDashboard();
}

export interface AddTaskInput {
  title: string;
  type?: string;
  effort: number;
  allowedPersons: "both" | "dome" | "emely";
  dueDateISO: string;
  rhythm?: string | null;
  icon?: string | null;
  assignToKey?: "dome" | "emely" | null;
}

/** Creates a new standalone task from the mobile quick-add form. */
export async function addTaskAction(input: AddTaskInput): Promise<void> {
  const repoInput: CreateTaskInput = {
    title: input.title,
    type: input.type,
    effort: input.effort,
    allowedPersons: input.allowedPersons,
    dueDate: new Date(input.dueDateISO),
    rhythm: input.rhythm,
    icon: input.icon,
    assignToKey: input.assignToKey,
  };
  await createTask(repoInput);
  revalidateDashboard();
}
