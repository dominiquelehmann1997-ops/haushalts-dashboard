// Draft-Lifecycle des Wochen-Essensplans: einen erzeugten Entwurf abnicken
// (→ aktiv) oder verwerfen. Aktiver Plan und Entwurf koexistieren über
// `MealPlanEntry.status` ("active" | "draft").

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { MealPlanEntry, Recipe } from "@/generated/prisma/client";
import { dayBounds, weekBoundsOf } from "@/lib/dates";
import { candidatesFor } from "./mealPlanner";
import { constraintFromEntry, type DayConstraint, type MealReason } from "./mealConstraints";

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

/** Findet den Entwurfs-Eintrag (`status:"draft"`) am lokalen Tag von `date`. */
async function findDraftEntryForDay(date: Date, client: PrismaClient) {
  const { start, end } = dayBounds(date);
  return client.mealPlanEntry.findFirst({
    where: { date: { gte: start, lte: end }, status: "draft" },
  });
}

/**
 * Würfelt das Rezept eines Entwurfs-Tages neu — dienstbewusst: rekonstruiert den
 * Tages-Constraint aus dem Eintrag, nutzt dieselbe Pool-Logik wie der Planer und
 * schließt das aktuelle Rezept möglichst aus. `reason`/`extraPortion` bleiben.
 * Gibt `null`, wenn es keinen Entwurfs-Eintrag für den Tag gibt.
 */
export async function rerollDraftDay(
  date: Date,
  preferSimple: boolean,
  client: PrismaClient = prisma,
  rng: () => number = Math.random,
): Promise<MealPlanEntry | null> {
  const entry = await findDraftEntryForDay(date, client);
  if (!entry) return null;

  const recipes: Recipe[] = await client.recipe.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  if (recipes.length === 0) return null; // nothing to pick from (mirrors generateWeekPlan)
  const { needsSimple, needsReheatable } = constraintFromEntry(entry.reason, entry.extraPortion);
  // `reason` is free-text String? in the DB, but only generateWeekPlan writes it
  // (from deriveDayConstraints → MealReason | null), so the cast is safe here.
  const constraint: DayConstraint = {
    date: entry.date,
    needsSimple,
    needsReheatable,
    extraPortion: entry.extraPortion,
    reason: entry.reason as MealReason | null,
  };

  const pool = candidatesFor(constraint, recipes, preferSimple);
  const others = pool.filter((r) => r.id !== entry.recipeId);
  const choices = others.length > 0 ? others : pool;
  const pick = choices[Math.floor(rng() * choices.length)];

  return client.mealPlanEntry.update({
    where: { id: entry.id },
    data: { recipeId: pick.id },
  });
}

/**
 * Setzt manuell das Rezept eines Entwurfs-Tages (Tausch aus dem Rezeptbuch).
 * Gibt `null`, wenn es keinen Entwurfs-Eintrag für den Tag gibt.
 */
export async function setDraftDayRecipe(
  date: Date,
  recipeId: string,
  client: PrismaClient = prisma,
): Promise<MealPlanEntry | null> {
  const entry = await findDraftEntryForDay(date, client);
  if (!entry) return null;
  return client.mealPlanEntry.update({
    where: { id: entry.id },
    data: { recipeId },
  });
}
