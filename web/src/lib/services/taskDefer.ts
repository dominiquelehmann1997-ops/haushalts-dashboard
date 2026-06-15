import { nextDueDate } from "@/lib/services/recurrence";

/**
 * Nächster sinnvoller Fälligkeitstag beim manuellen Aufschieben:
 * - mit Rhythmus → nächster Rhythmus-Tag (recurrence.nextDueDate)
 * - ohne Rhythmus (Einmal-/Einkaufsaufgabe) → morgen
 * `from` wird nicht mutiert.
 */
export function nextSensibleDay(task: { rhythm: string | null }, from: Date): Date {
  if (task.rhythm) {
    return nextDueDate(task.rhythm, from);
  }
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  return next;
}
