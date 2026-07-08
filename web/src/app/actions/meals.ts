"use server";

// Server Actions rund um den Wochen-Essensplan (Roadmap C1/D1 + Folge-Iteration).
// Erzeugen schreibt einen Entwurf (dienstbewusst, keine Einkauf-Berührung).
// Bearbeiten würfelt einen Tag neu oder tauscht sein Rezept. Abnicken befördert
// den Entwurf nur zum aktiven Plan — Bring wird dabei bewusst NICHT berührt.
// Der Bring-Push passiert erst später, pro Gericht, aus der aktiven Wochenübersicht.

import { revalidateDashboard } from "@/lib/revalidate";

import { sendToAdults } from "@/lib/services/pushNotify";
import { generateWeekPlan } from "@/lib/services/mealPlanner";
import { deriveDayConstraints } from "@/lib/services/mealConstraints";
import {
  approveDraft,
  discardDraft,
  rerollDraftDay,
  setDraftDayRecipe,
  setActiveDayRecipe,
} from "@/lib/services/mealDraft";
import { pushMealIngredients } from "@/lib/services/mealIngredientPush";
import { getActivePhase } from "@/lib/repositories/phase";
import { getDomeShiftsForWeek } from "@/lib/repositories/meals";
import { ingestVaultIfConfigured } from "@/lib/repositories/recipeIngest";
import { localDateKey } from "@/lib/dates";
import type { BringPushResult } from "@/integrations/bring/client";

/** Generiert die dienstbewusste ENTWURF-Woche (kein Einkauf/Bring). */
export async function generatePlanAction(weekStartISO: string): Promise<void> {
  const weekStart = new Date(weekStartISO);

  // Auto-Sync: vor dem Entwurf den Rezepte-Vault (Obsidian) einlesen, damit
  // neue Rezepte ohne manuellen "Rezepte einlesen"-Klick zur Auswahl stehen.
  // Non-fatal — ein Vault-Fehler darf die Entwurfserzeugung nicht scheitern lassen.
  try {
    await ingestVaultIfConfigured();
  } catch {
    // Ingest-Fehler ignorieren; mit dem bestehenden Rezeptbuch weitermachen.
  }

  const phase = await getActivePhase();

  const shifts = await getDomeShiftsForWeek(weekStart);
  const constraints = deriveDayConstraints(
    weekStart,
    (date) => shifts.get(localDateKey(date)) ?? null,
  );

  await generateWeekPlan(weekStart, {
    preferSimple: phase?.mode === "elternzeit",
    constraints,
  });

  // Roadmap C2: Beide Handys benachrichtigen, dass ein Entwurf bereitliegt.
  // Non-fatal — ein Push-Fehler darf die Entwurfserzeugung nicht scheitern lassen.
  await sendToAdults({
    title: "Essensplan-Entwurf bereit 🍽️",
    body: "Antippen zum Abnicken oder Ändern.",
    url: "/",
  });

  revalidateDashboard();
}

/** Re-rolls a single draft day's recipe (dienstbewusst). */
export async function rerollDraftDayAction(dateISO: string): Promise<void> {
  const phase = await getActivePhase();
  await rerollDraftDay(new Date(dateISO), phase?.mode === "elternzeit");
  revalidateDashboard();
}

/** Manually swaps a draft day's recipe. */
export async function setDraftDayRecipeAction(dateISO: string, recipeId: string): Promise<void> {
  await setDraftDayRecipe(new Date(dateISO), recipeId);
  revalidateDashboard();
}

/** Discards the week's draft. */
export async function discardDraftAction(weekStartISO: string): Promise<void> {
  const weekStart = new Date(weekStartISO);
  await discardDraft(weekStart);
  revalidateDashboard();
}

/**
 * Approves the week's draft: promotes it to the active plan. Berührt bewusst
 * weder Einkaufsliste noch Bring — das passiert erst später, pro Gericht, aus
 * der aktiven Wochenübersicht (siehe `pushMealIngredientsAction`).
 */
export async function approveDraftAction(weekStartISO: string): Promise<{ approved: boolean }> {
  const weekStart = new Date(weekStartISO);
  const approved = await approveDraft(weekStart);
  revalidateDashboard();
  return { approved };
}

/** Tauscht das Rezept eines Tages im AKTIVEN Plan (z.B. wenn sich die Woche noch ändert). */
export async function setActiveDayRecipeAction(dateISO: string, recipeId: string): Promise<void> {
  await setActiveDayRecipe(new Date(dateISO), recipeId);
  revalidateDashboard();
}

/**
 * Pusht die Zutaten EINES Gerichts (ein `MealPlanEntry` des aktiven Plans) auf
 * Bring!. Never throws — liefert das Bring-Ergebnis + die betroffenen Namen
 * (für den Kopier-Fallback in der UI).
 */
export async function pushMealIngredientsAction(
  entryId: string,
): Promise<{ bring: BringPushResult; items: string[] }> {
  const result = await pushMealIngredients(entryId);
  revalidateDashboard();
  return result;
}
