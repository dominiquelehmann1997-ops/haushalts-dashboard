// Draft-Lifecycle des Wochen-Essensplans: einen erzeugten Entwurf abnicken
// (→ aktiv) oder verwerfen. Aktiver Plan und Entwurf koexistieren über
// `MealPlanEntry.status` ("active" | "draft").

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { weekBoundsOf } from "@/lib/dates";

/**
 * Befördert den Entwurf der Woche zum aktiven Plan: löscht die aktiven Einträge
 * der Woche und setzt die Entwurfs-Einträge auf `status:"active"` — in einer
 * Transaktion. Gibt `false` zurück (no-op), wenn es keinen Entwurf gibt.
 */
export async function approveDraft(
  weekStart: Date,
  client: PrismaClient = prisma,
): Promise<boolean> {
  const { start, end } = weekBoundsOf(weekStart);
  const draftCount = await client.mealPlanEntry.count({
    where: { date: { gte: start, lte: end }, status: "draft" },
  });
  if (draftCount === 0) return false;

  await client.$transaction([
    client.mealPlanEntry.deleteMany({
      where: { date: { gte: start, lte: end }, status: "active" },
    }),
    client.mealPlanEntry.updateMany({
      where: { date: { gte: start, lte: end }, status: "draft" },
      data: { status: "active" },
    }),
  ]);
  return true;
}

/** Verwirft den Entwurf der Woche (löscht nur `status:"draft"`-Einträge). */
export async function discardDraft(
  weekStart: Date,
  client: PrismaClient = prisma,
): Promise<void> {
  const { start, end } = weekBoundsOf(weekStart);
  await client.mealPlanEntry.deleteMany({
    where: { date: { gte: start, lte: end }, status: "draft" },
  });
}
