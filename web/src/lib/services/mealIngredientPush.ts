// Pusht die Zutaten EINES Gerichts (ein `MealPlanEntry` des aktiven Plans) auf
// Bring! — der bewusste Zwischenschritt aus der aktiven Wochenübersicht statt
// eines automatischen Pushs beim Abnicken. Der Push selbst ist injizierbar
// (Default `pushShoppingList`), damit die Auswahl-/Markier-Logik ohne Netz
// testbar ist.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { combineAmounts, type AmountPart } from "@/lib/services/ingredientAmount";
import {
  pushShoppingList,
  type BringItem,
  type BringPushResult,
} from "@/integrations/bring/client";

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

  const byName = new Map<string, { name: string; amounts: AmountPart[] }>();
  for (const ingredient of entry.recipe.ingredients) {
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
  if (entries.length === 0) return { bring: { ok: true, pushed: 0 }, items: [] };

  const bringItems: BringItem[] = entries.map((e) => {
    const spec = combineAmounts(e.amounts);
    return spec ? { name: e.name, spec } : { name: e.name };
  });

  const bring = await push(bringItems);
  if (bring.ok) {
    await client.mealPlanEntry.update({
      where: { id: entry.id },
      data: { ingredientsPushedAt: new Date() },
    });
  }

  return { bring, items: entries.map((e) => e.name) };
}
