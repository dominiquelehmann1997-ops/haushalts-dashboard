// Einkaufs-Rutschen (Batches) für den Bring-Push beim Abnicken.
//
// SCHRITT-D-NAHT (siehe Spec 2026-06-09): Heute (C1) wird der Wochenplan in
// GENAU EINER Rutsche eingekauft. Schritt D ersetzt nur diese Funktion und
// gruppiert die Zutaten nach Haltbarkeit/Einkaufstermin in mehrere Batches
// (dann ggf. je mit Datum/Label). Der Approve-Flow iteriert die Batches und
// pusht jede einzeln — diese Schleife bleibt für D unverändert.

import type { BringItem } from "@/integrations/bring/client";

export interface IngredientBatch {
  /** Optionales Label/Datum (für Schritt D); in C1 ungenutzt. */
  label?: string;
  items: BringItem[];
}

/**
 * Gruppiert Zutaten-Namen in Einkaufs-Rutschen. C1: eine Rutsche mit allen
 * Zutaten (leere Liste → keine Rutsche). Reine Funktion, kein DB/Netz.
 */
export function planShoppingBatches(ingredientNames: string[]): IngredientBatch[] {
  if (ingredientNames.length === 0) return [];
  return [{ items: ingredientNames.map((name) => ({ name })) }];
}
