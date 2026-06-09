"use server";

// Thin Server Action wrapper around the meal-planning services — generates
// the week's plan (recipe-book selection, phase-aware ordering, shuffled day
// assignment), syncs the derived ingredients into the shared shopping list,
// pushes exactly those ingredients to Bring!, then revalidates the dashboard.
// No business logic here: recipe selection lives in `generateWeekPlan`,
// ingredient aggregation in `syncIngredientsToShopping`, the Bring push in
// `@/integrations/bring/client` (see `@/lib/services/*`).

import { revalidatePath } from "next/cache";

import { generateWeekPlan } from "@/lib/services/mealPlanner";
import { deriveDayConstraints } from "@/lib/services/mealConstraints";
import { syncIngredientsToShopping } from "@/lib/services/shoppingSync";
import { getActivePhase } from "@/lib/repositories/phase";
import { getDomeShiftsForWeek } from "@/lib/repositories/meals";
import { localDateKey } from "@/lib/dates";
import { pushShoppingList, type BringPushResult } from "@/integrations/bring/client";

export interface GeneratePlanResult {
  /** The recipe ingredient names written to the list (and pushed to Bring). */
  ingredients: string[];
  /** Outcome of pushing those ingredients to Bring! (never throws). */
  bring: BringPushResult;
}

/**
 * Generates the meal plan for the week containing `weekStart`, syncs its
 * ingredients into the shopping list, and pushes *only those recipe
 * ingredients* to Bring! (manual items are left untouched). In "Elternzeit"
 * mode, simple recipes are preferred (less cooking effort for the caregiving
 * phase). The day→recipe assignment is shuffled, so each call yields a fresh
 * plan.
 *
 * Returns the ingredients and the Bring push result so the UI can confirm
 * success or offer the manual copy-to-clipboard fallback.
 */
export async function generatePlanAction(weekStart: Date): Promise<GeneratePlanResult> {
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
  const ingredients = await syncIngredientsToShopping();

  const bring = await pushShoppingList(ingredients.map((name) => ({ name })));

  revalidatePath("/");

  return { ingredients, bring };
}
