"use server";

// Server Actions rund um den Wochen-Essensplan-Entwurf (Roadmap C1/D1).
// Erzeugen schreibt einen Entwurf (dienstbewusst, keine Einkauf-Berührung).
// Bearbeiten würfelt einen Tag neu oder tauscht sein Rezept. Abnicken pusht nur
// die **haltbar**-Rutsche sofort auf Bring; die **frisch**-Rutsche folgt später
// per `pushFreshBatchAction` (Roadmap D1).

import { revalidatePath } from "next/cache";

import { sendToAdults } from "@/lib/services/pushNotify";
import { generateWeekPlan } from "@/lib/services/mealPlanner";
import { deriveDayConstraints } from "@/lib/services/mealConstraints";
import {
  approveDraft,
  discardDraft,
  rerollDraftDay,
  setDraftDayRecipe,
} from "@/lib/services/mealDraft";
import { syncIngredientsToShopping } from "@/lib/services/shoppingSync";
import { pushRecipeBatch } from "@/lib/services/shoppingBatch";
import { getFreshShoppingState } from "@/lib/repositories/shopping";
import { getActivePhase } from "@/lib/repositories/phase";
import { getDomeShiftsForWeek } from "@/lib/repositories/meals";
import { localDateKey } from "@/lib/dates";
import type { BringPushResult } from "@/integrations/bring/client";
import type { FreshShoppingState } from "@/lib/domain";

/** Result of approving a draft: the haltbar push outcome + the pending fresh state. */
export interface ApprovePlanResult {
  /** `false` when there was no draft to approve. */
  approved: boolean;
  /** Haltbar ingredient names pushed to Bring (empty if not approved) — for the copy fallback. */
  ingredients: string[];
  /** Outcome of pushing the *haltbar* batch to Bring! (never throws). */
  bring: BringPushResult;
  /** Pending fresh batch (items + suggested day) to surface in the dashboard. */
  fresh: FreshShoppingState;
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

  // Roadmap C2: Beide Handys benachrichtigen, dass ein Entwurf bereitliegt.
  // Non-fatal — ein Push-Fehler darf die Entwurfserzeugung nicht scheitern lassen.
  await sendToAdults({
    title: "Essensplan-Entwurf bereit 🍽️",
    body: "Antippen zum Abnicken oder Ändern.",
    url: "/",
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
 * Approves the week's draft: promotes it to the active plan, syncs its
 * ingredients onto the shopping list, then pushes ONLY the "haltbar" batch to
 * Bring! immediately. The "frisch" batch stays pending and is surfaced via the
 * returned `fresh` state (pushed later by the user). A Bring failure does NOT
 * undo the approval.
 */
export async function approveDraftAction(weekStartISO: string): Promise<ApprovePlanResult> {
  const weekStart = new Date(weekStartISO);
  const approved = await approveDraft(weekStart);
  if (!approved) {
    revalidatePath("/");
    return {
      approved: false,
      ingredients: [],
      bring: { ok: true, pushed: 0 },
      fresh: { pendingItems: [], suggestedDayISO: null },
    };
  }

  // syncIngredientsToShopping operates on the current ISO week (see shoppingSync);
  // in C1/D1 the UI only ever approves the current week's draft.
  await syncIngredientsToShopping();
  const haltbar = await pushRecipeBatch("haltbar");
  const fresh = await getFreshShoppingState();

  revalidatePath("/");
  return { approved: true, ingredients: haltbar.items, bring: haltbar.bring, fresh };
}

/**
 * Pushes the pending "frisch" batch to Bring! (the deferred second shopping run).
 * Returns the push outcome + the affected names for the copy fallback.
 */
export async function pushFreshBatchAction(): Promise<{ bring: BringPushResult; items: string[] }> {
  const result = await pushRecipeBatch("frisch");
  revalidatePath("/");
  return result;
}
