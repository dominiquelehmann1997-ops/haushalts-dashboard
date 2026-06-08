"use server";

// Thin Server Action wrappers around the shopping repository and the Bring!
// integration (Phase 7) — mutate/push, then revalidate the dashboard so the
// UI reflects the new state.

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { setShoppingDone, getShoppingItems } from "@/lib/repositories/shopping";
import { pushShoppingList, toBringItems, type BringPushResult } from "@/integrations/bring/client";

/** Toggles a shopping item's `done` flag. */
export async function toggleShoppingAction(id: string): Promise<void> {
  const item = await prisma.shoppingItem.findUniqueOrThrow({ where: { id } });

  await setShoppingDone(id, !item.done);

  revalidatePath("/");
}

/**
 * Pushes the currently open shopping items to Bring! (one-way, dashboard →
 * Bring!). Read-only with respect to the dashboard's own data — no
 * `revalidatePath` needed. Never throws: `pushShoppingList` always resolves to
 * a result the UI can show directly, including a manual-fallback hint on
 * failure (see `docs/spikes/2026-06-07-bring-machbarkeit.md`).
 */
export async function pushToBringAction(): Promise<BringPushResult> {
  const items = await getShoppingItems();
  return pushShoppingList(toBringItems(items));
}
