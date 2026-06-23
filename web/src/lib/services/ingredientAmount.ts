// Mengen-Aggregation für die Bring-Übertragung: fasst die Mengenangaben einer
// (über mehrere Wochen-Rezepte hinweg) zusammengeführten Zutat zu *einer*
// Anzeige-Zeile zusammen — Bring nimmt diese als optionale `spec`-Detailzeile.
//
// Regel (vom Haushalt gewünscht): gleiche Einheit → numerisch summieren
// (200 g + 300 g = 500 g), unterschiedliche Einheit oder nicht-numerische Menge
// → mit „ + " verketten. Keine Menge → null (dann sendet die App nur den Namen).

export interface AmountPart {
  amount: string | null;
  unit: string | null;
}

/** Deutsche Dezimalzahl ("0,5") → number; null wenn nicht parsebar. */
function parseAmount(amount: string): number | null {
  const n = Number(amount.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** number → deutsche Darstellung (Komma, max. 2 Nachkommastellen, keine Null-Endung). */
function formatNumber(n: number): string {
  return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")).replace(".", ",");
}

/** Hängt eine optionale Einheit an einen Mengen-Text. */
function withUnit(value: string, unit: string): string {
  return unit ? `${value} ${unit}` : value;
}

/**
 * Fasst die Mengen mehrerer Vorkommen derselben Zutat zu einer Zeile zusammen.
 * Leere/fehlende Mengen werden ignoriert; bleibt nichts übrig → null.
 */
export function combineAmounts(parts: AmountPart[]): string | null {
  const present = parts
    .map((p) => ({ amount: (p.amount ?? "").trim(), unit: (p.unit ?? "").trim() }))
    .filter((p) => p.amount !== "");

  if (present.length === 0) return null;

  // Nach Einheit gruppieren, Reihenfolge des ersten Auftretens bewahren.
  const groups = new Map<string, { amount: string; unit: string }[]>();
  for (const p of present) {
    const list = groups.get(p.unit) ?? [];
    list.push(p);
    groups.set(p.unit, list);
  }

  const segments: string[] = [];
  for (const [unit, list] of groups) {
    const numbers = list.map((p) => parseAmount(p.amount));
    if (numbers.every((n) => n !== null)) {
      const sum = (numbers as number[]).reduce((a, b) => a + b, 0);
      segments.push(withUnit(formatNumber(sum), unit));
    } else {
      // Nicht alle numerisch → roh verketten, jede Angabe einzeln.
      for (const p of list) segments.push(withUnit(p.amount, unit));
    }
  }

  return segments.join(" + ");
}
