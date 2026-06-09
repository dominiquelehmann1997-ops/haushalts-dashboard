"use server";

// Server Actions rund um den Wochen-Essensplan-Entwurf (Roadmap C1).
// Erzeugen schreibt einen Entwurf (dienstbewusst, keine Einkauf-Berührung).
// Bearbeiten würfelt einen Tag neu oder tauscht sein Rezept. Abnicken befördert
// den Entwurf zum aktiven Plan und pusht dann die Zutaten — batch-fähig
// (`planShoppingBatches`; C1 eine Rutsche) — auf Einkaufsliste + Bring.

import { revalidatePath } from "next/cache";

import { generateWeekPlan } from "@/lib/services/mealPlanner";
import { deriveDayConstraints } from "@/lib/services/mealConstraints";
import {
  approveDraft,
  discardDraft,
  rerollDraftDay,
  setDraftDayRecipe,
} from "@/lib/services/mealDraft";
import { syncIngredientsToShopping } from "@/lib/services/shoppingSync";
import { planShoppingBatches } from "@/lib/services/shoppingBatches";
import { getActivePhase } from "@/lib/repositories/phase";
import { getDomeShiftsForWeek } from "@/lib/repositories/meals";
import { localDateKey } from "@/lib/dates";
import { pushShoppingList, type BringPushResult } from "@/integrations/bring/client";

/** Result of approving a draft and pushing its ingredients. */
export interface ApprovePlanResult {
  /** `false` when there was no draft to approve. */
  approved: boolean;
  /** Recipe ingredient names written to the list (empty if not approved). */
  ingredients: string[];
  /** Aggregated outcome of pushing the batches to Bring! (never throws). */
  bring: BringPushResult;
}

/** Generates the dienstbewusst DRAFT plan for the week (no shopping/Bring). */
export async function generatePlanAction(weekStartISO: string): Promise<void> {
  const weekStart = new Date(weekStartISO);
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

  revalidatePath("/");
}

/** Re-rolls a single draft day's recipe (dienstbewusst). */
export async function rerollDraftDayAction(dateISO: string): Promise<void> {
  const phase = await getActivePhase();
  await rerollDraftDay(new Date(dateISO), phase?.mode === "elternzeit");
  revalidatePath("/");
}

/** Manually swaps a draft day's recipe. */
export async function setDraftDayRecipeAction(dateISO: string, recipeId: string): Promise<void> {
  await setDraftDayRecipe(new Date(dateISO), recipeId);
  revalidatePath("/");
}

/** Discards the week's draft. */
export async function discardDraftAction(weekStartISO: string): Promise<void> {
  const weekStart = new Date(weekStartISO);
  await discardDraft(weekStart);
  revalidatePath("/");
}

/**
 * Approves the week's draft: promotes it to the active plan, then syncs its
 * ingredients onto the shopping list and pushes them to Bring! in batches
 * (C1: one batch). Returns the outcome for the UI's confirmation pill /
 * manual-copy fallback. A Bring failure does NOT undo the approval.
 */
export async function approveDraftAction(weekStartISO: string): Promise<ApprovePlanResult> {
  const weekStart = new Date(weekStartISO);
  const approved = await approveDraft(weekStart);
  if (!approved) {
    revalidatePath("/");
    return { approved: false, ingredients: [], bring: { ok: true, pushed: 0 } };
  }

  // syncIngredientsToShopping operates on the current ISO week (see shoppingSync);
  // in C1 the UI only ever approves the current week's draft.
  const ingredients = await syncIngredientsToShopping();
  const batches = planShoppingBatches(ingredients);

  let bring: BringPushResult = { ok: true, pushed: 0 };
  let pushed = 0;
  for (const batch of batches) {
    const result = await pushShoppingList(batch.items);
    if (!result.ok) {
      bring = result;
      break;
    }
    pushed += result.pushed;
    bring = { ok: true, pushed };
  }

  revalidatePath("/");
  return { approved: true, ingredients, bring };
}
