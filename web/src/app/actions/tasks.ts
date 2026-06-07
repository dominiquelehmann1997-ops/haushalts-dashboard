"use server";

// Thin Server Action wrappers around the tasks repository — mutate, then
// revalidate the dashboard so the UI reflects the new state. No business
// logic here: status transitions and bookings are single-sourced in
// `setTaskStatus` (see `@/lib/repositories/tasks`).

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { setTaskStatus } from "@/lib/repositories/tasks";

/** Toggles a task between "open" and "done"; other statuses are a no-op. */
export async function toggleTaskAction(id: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({ where: { id } });

  if (task.status === "open") {
    await setTaskStatus(id, "done", null);
  } else if (task.status === "done") {
    await setTaskStatus(id, "open", null);
  }

  revalidatePath("/");
}

/** Marks a task as "moved" with a reason (e.g. weather/availability deferral). */
export async function deferTaskAction(id: string, reason: string): Promise<void> {
  await setTaskStatus(id, "moved", reason);
  revalidatePath("/");
}

/** Marks a task as "failed" with a reason. */
export async function failTaskAction(id: string, reason: string): Promise<void> {
  await setTaskStatus(id, "failed", reason);
  revalidatePath("/");
}
