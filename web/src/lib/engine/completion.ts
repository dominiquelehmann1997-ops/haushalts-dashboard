import type { PersonKey } from "./types";

export interface CompletableTask {
  id: string;
  title: string;
  status: "open" | "done" | "moved" | "failed";
  effort: number;
  assignedTo: PersonKey | null;
}

export interface AccountEntryInput {
  personKey: PersonKey;
  points: number;
  source: "planned";
  label: string;
  taskId: string;
}

/**
 * Builds an account-entry input for a completed, assigned task — or `null` when
 * the task isn't done yet, or has no assignee to credit.
 */
export function recordCompletion(task: CompletableTask): AccountEntryInput | null {
  if (task.status !== "done" || !task.assignedTo) return null;

  return {
    personKey: task.assignedTo,
    points: task.effort,
    source: "planned",
    label: task.title,
    taskId: task.id,
  };
}
