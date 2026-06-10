// Repository für das Haltbarkeits-Korrektur-Gedächtnis (Sanftes Lernen C1):
// liest alle Overrides als Map fürs Auflösen beim Lesen und schreibt eine
// Korrektur (Toggle am Einkaufs-Item → Override + sofortiges Item-Update).

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { normalizeIngredientName, type Freshness } from "@/lib/services/freshness";

/** Alle gelernten Overrides als Map: normalisierter Name → "frisch" | "haltbar". */
export async function getFreshnessOverrides(
  client: PrismaClient = prisma,
): Promise<Map<string, Freshness>> {
  const rows = await client.freshnessOverride.findMany();
  return new Map(rows.map((r) => [r.name, r.freshness === "frisch" ? "frisch" : "haltbar"]));
}

/**
 * Korrigiert die Haltbarkeit eines Rezept-Einkaufs-Items: flippt dessen
 * `category`, upserted den Override unter dem normalisierten Namen und liefert
 * den neuen Wert. `null` (no-op) für manuelle Items oder Items ohne Kategorie.
 */
export async function toggleItemFreshness(
  itemId: string,
  client: PrismaClient = prisma,
): Promise<Freshness | null> {
  const item = await client.shoppingItem.findUnique({ where: { id: itemId } });
  if (
    !item ||
    item.source !== "recipe" ||
    (item.category !== "frisch" && item.category !== "haltbar")
  ) {
    return null;
  }

  const next: Freshness = item.category === "frisch" ? "haltbar" : "frisch";
  const name = normalizeIngredientName(item.text);

  await client.freshnessOverride.upsert({
    where: { name },
    create: { name, freshness: next },
    update: { freshness: next },
  });
  await client.shoppingItem.update({ where: { id: itemId }, data: { category: next } });

  return next;
}
