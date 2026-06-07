"use server";

// Thin Server Action wrapper around the meal-planning services — generates
// the week's plan (recipe-book selection, phase-aware ordering), syncs the
// derived ingredients into the shared shopping list, then revalidates the
// dashboard so the UI reflects the new state. No business logic here: recipe
// selection lives in `generateWeekPlan`, ingredient aggregation in
// `syncIngredientsToShopping` (see `@/lib/services/*`).

import { revalidatePath } from "next/cache";

import { generateWeekPlan } from "@/lib/services/mealPlanner";
import { syncIngredientsToShopping } from "@/lib/services/shoppingSync";
import { getActivePhase } from "@/lib/repositories/phase";

/**
 * Generates the meal plan for the week containing `weekStart` and syncs its
 * ingredients into the shopping list. In "Elternzeit" mode, simple recipes
 * are preferred (less cooking effort for the caregiving phase).
 */
export async function generatePlanAction(weekStart: Date): Promise<void> {
  const phase = await getActivePhase();

  await generateWeekPlan(weekStart, { preferSimple: phase?.mode === "elternzeit" });
  await syncIngredientsToShopping();

  revalidatePath("/");
}
