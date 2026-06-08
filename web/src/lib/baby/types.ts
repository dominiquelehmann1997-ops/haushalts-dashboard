// Pure type contract for the baby clothing / UV recommendation logic.
// No imports from db/repositories/integrations/next/prisma — pure logic,
// mirrors the engine's purity rule so it stays unit-testable.

export type Situation =
  | "kinderwagen"
  | "babytrage"
  | "auto"
  | "schlafen"
  | "zuhause"
  | "allgemein";

export type AgeBand = "0-3m" | "4m+";

export type Warmth = "heiß" | "warm" | "mild" | "kühl" | "kalt" | "frost";

export interface ClothingAdvice {
  tempBand: string; // e.g. "13–17 °C"
  layers: string[]; // onion-principle layers, e.g. ["Windel","Langarmbody","Hose"]
  warmth: Warmth;
  hint?: string; // situation-/age-specific note
}

export type UvLevel = "niedrig" | "mäßig" | "hoch" | "sehr hoch" | "extrem";

export interface UvAdvice {
  index: number;
  level: UvLevel;
  advice: string;
}
