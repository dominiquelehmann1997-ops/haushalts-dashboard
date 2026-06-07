// Repository for the shared shopping list.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { ShoppingItem } from "@/lib/domain";

/** All shopping items, not-done first then by creation order, mapped to the domain DTO. */
export async function getShoppingItems(client: PrismaClient = prisma): Promise<ShoppingItem[]> {
  const rows = await client.shoppingItem.findMany({
    orderBy: [{ done: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    meal: row.meal,
    done: row.done,
  }));
}
