// Pure UV-protection advice for babies. Standard WMO/WHO UV-index bands, with
// stronger guidance for young infants (0-3m: shade + clothing rather than
// sunscreen). No I/O.

import type { AgeBand, UvAdvice, UvLevel } from "./types";

function levelFor(index: number): UvLevel {
  if (index <= 2) return "niedrig";
  if (index <= 5) return "mäßig";
  if (index <= 7) return "hoch";
  if (index <= 10) return "sehr hoch";
  return "extrem";
}

/**
 * UV-protection advice for the given index and age band. Infants (`0-3m`) get
 * the "shade and clothing instead of sunscreen" guidance from "mäßig" upward;
 * older babies get the lighter, sunscreen-inclusive variant.
 */
export function uvAdvice(index: number, ageBand: AgeBand): UvAdvice {
  const level = levelFor(index);
  const infant = ageBand === "0-3m";

  let advice: string;
  switch (level) {
    case "niedrig":
      advice = "UV niedrig – kein besonderer Sonnenschutz nötig.";
      break;
    case "mäßig":
      advice = infant
        ? "Schatten suchen, Sonnenhut und lange, leichte Kleidung. Bei Säuglingen Kleidung statt Sonnencreme."
        : "Mittags Schatten, Sonnenhut; Sonnencreme auf freie Hautstellen.";
      break;
    case "hoch":
      advice = infant
        ? "Direkte Sonne meiden. Schatten, Sonnenhut und lange Kleidung; bei Säuglingen Kleidung statt Creme."
        : "Direkte Mittagssonne meiden – Schatten, Sonnenhut und Sonnencreme.";
      break;
    case "sehr hoch":
      advice = infant
        ? "Direkte Sonne unbedingt meiden – Schatten, Sonnenhut, lange Kleidung. Zeit im Freien kurz halten."
        : "Direkte Sonne meiden, konsequent Schatten, Sonnenhut und Sonnencreme.";
      break;
    case "extrem":
      advice = infant
        ? "Extreme UV-Belastung: direkte Sonne meiden, möglichst drinnen oder im Schatten bleiben."
        : "Extreme UV-Belastung: direkte Sonne meiden, Schatten, Sonnenhut und Sonnencreme.";
      break;
  }

  return { index, level, advice };
}
