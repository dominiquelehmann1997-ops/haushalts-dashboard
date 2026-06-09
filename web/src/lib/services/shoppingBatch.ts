// Pusht eine Einkaufs-Rutsche (eine Haltbarkeits-Kategorie der Rezept-Items) auf
// Bring und markiert sie als gepusht. Roadmap D1: "haltbar" beim Abnicken,
// "frisch" später per Knopf. Der Push selbst ist injizierbar (Default
// `pushShoppingList`), damit die Auswahl-/Markier-Logik ohne Netz testbar ist.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import {
  pushShoppingList,
  type BringItem,
  type BringPushResult,
} from "@/integrations/bring/client";

/**
 * Pusht die noch nicht gepushten, offenen Rezept-Items der Kategorie `category`
 * (`source:"recipe"`, `pushed:false`, `done:false`) auf Bring und setzt bei
 * Erfolg `pushed=true`. Liefert das Bring-Ergebnis und die betroffenen Namen
 * (für den Kopier-Fallback). Leere Auswahl → no-op-Erfolg.
 */
export async function pushRecipeBatch(
  category: "frisch" | "haltbar",
  client: PrismaClient = prisma,
  push: (items: BringItem[]) => Promise<BringPushResult> = pushShoppingList,
): Promise<{ bring: BringPushResult; items: string[] }> {
  const rows = await client.shoppingItem.findMany({
    where: { source: "recipe", category, pushed: false, done: false },
    orderBy: { createdAt: "asc" },
  });
  const items = rows.map((r) => r.text);
  if (items.length === 0) return { bring: { ok: true, pushed: 0 }, items: [] };

  const bring = await push(rows.map((r) => ({ name: r.text })));
  if (bring.ok) {
    await client.shoppingItem.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { pushed: true },
    });
  }
  return { bring, items };
}
