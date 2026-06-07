"use server";

// Thin Server Action wrapper around the shopping repository — mutate, then
// revalidate the dashboard so the UI reflects the new state.

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { setShoppingDone } from "@/lib/repositories/shopping";

/** Toggles a shopping item's `done` flag. */
export async function toggleShoppingAction(id: string): Promise<void> {
  const item = await prisma.shoppingItem.findUniqueOrThrow({ where: { id } });

  await setShoppingDone(id, !item.done);

  revalidatePath("/");
}
