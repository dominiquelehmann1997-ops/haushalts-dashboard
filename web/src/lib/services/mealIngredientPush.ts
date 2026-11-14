// Pusht die Zutaten EINES Gerichts (ein `MealPlanEntry` des aktiven Plans) auf
// Bring! — der bewusste Zwischenschritt aus der aktiven Wochenübersicht statt
// eines automatischen Pushs beim Abnicken. Der Push selbst ist injizierbar
// (Default `pushShoppingList`), damit die Auswahl-/Markier-Logik ohne Netz
// testbar ist.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { combineAmounts, type AmountPart } from "@/lib/services/ingredientAmount";
import { clampPortions, scaleAmount } from "@/lib/services/portions";
import {
  pushShoppingList,
  type BringItem,
  type BringPushResult,
} from "@/integrations/bring/client";

type IngredientRow = { name: string; amount: string | null; unit: string | null };

/**
 * Fasst gleichnamige Zutaten über `combineAmounts` zu einer Mengenangabe
 * zusammen und baut daraus die Bring-Items.
 */
function toBringItems(ingredients: IngredientRow[]): { bringItems: BringItem[]; names: string[] } {
  const byName = new Map<string, { name: string; amounts: AmountPart[] }>();
  for (const ingredient of ingredients) {
    const key = ingredient.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.amounts.push({ amount: ingredient.amount, unit: ingredient.unit });
    } else {
      byName.set(key, {
        name: ingredient.name.trim(),
        amounts: [{ amount: ingredient.amount, unit: ingredient.unit }],
      });
    }
  }
  const entries = [...byName.values()];
  const bringItems: BringItem[] = entries.map((e) => {
    const spec = combineAmounts(e.amounts);
    return spec ? { name: e.name, spec } : { name: e.name };
  });
  return { bringItems, names: entries.map((e) => e.name) };
}

/**
 * Pusht die Zutaten eines beliebigen Rezepts (unabhängig vom Wochenplan) auf
 * Bring. Mit `portions` werden die Mengen vorher von `recipe.servings` auf die
 * gewünschte Portionszahl umgerechnet — ohne Portionsangabe am Rezept bleibt es
 * bei den Originalmengen. Kein Rezept/keine Zutaten → No-op-Erfolg.
 */
export async function pushRecipeIngredients(
  recipeId: string,
  portions: number | null = null,
  client: PrismaClient = prisma,
  push: (items: BringItem[]) => Promise<BringPushResult> = pushShoppingList,
): Promise<{ bring: BringPushResult; items: string[] }> {
  const recipe = await client.recipe.findUnique({
    where: { id: recipeId },
    include: { ingredients: true },
  });
  if (!recipe) return { bring: { ok: true, pushed: 0 }, items: [] };

  const base = recipe.servings;
  const factor = portions !== null && base && base > 0 ? clampPortions(portions) / base : 1;
  const scaled = recipe.ingredients.map((i) => ({ ...i, amount: scaleAmount(i.amount, factor) }));

  const { bringItems, names } = toBringItems(scaled);
  if (bringItems.length === 0) return { bring: { ok: true, pushed: 0 }, items: [] };

  const bring = await push(bringItems);
  return { bring, items: names };
}

/**
 * Pusht die Zutaten des Rezepts eines `MealPlanEntry` auf Bring und setzt bei
 * Erfolg `ingredientsPushedAt`. Gleichnamige Zutaten innerhalb des Rezepts
 * werden über `combineAmounts` zu einer Mengenangabe zusammengefasst. Kein
 * Eintrag/Rezept/Zutaten → No-op-Erfolg. Liefert das Bring-Ergebnis und die
 * betroffenen Namen (für den Kopier-Fallback).
 */
export async function pushMealIngredients(
  entryId: string,
  client: PrismaClient = prisma,
  push: (items: BringItem[]) => Promise<BringPushResult> = pushShoppingList,
): Promise<{ bring: BringPushResult; items: string[] }> {
  const entry = await client.mealPlanEntry.findUnique({
    where: { id: entryId },
    include: { recipe: { include: { ingredients: true } } },
  });
  if (!entry?.recipe) return { bring: { ok: true, pushed: 0 }, items: [] };

  const { bringItems, names } = toBringItems(entry.recipe.ingredients);
  if (bringItems.length === 0) return { bring: { ok: true, pushed: 0 }, items: [] };

  const bring = await push(bringItems);
  if (bring.ok) {
    await client.mealPlanEntry.update({
      where: { id: entry.id },
      data: { ingredientsPushedAt: new Date() },
    });
  }

  return { bring, items: names };
}
