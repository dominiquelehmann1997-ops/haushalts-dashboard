// Pure baby clothing recommendation logic (Zwiebelprinzip / onion principle).
// No I/O. Temperature → base layers, then situation- and age-specific
// adjustments. Own logic; warm-band layers calibrated against baby-wetter.de's
// public output, colder bands extended along the standard onion principle.

import type { AgeBand, ClothingAdvice, Situation, Warmth } from "./types";

export interface ClothingInput {
  tempC: number;
  situation: Situation;
  ageBand: AgeBand;
}

interface Band {
  warmth: Warmth;
  tempBand: string;
  /** Outdoor base layers for a 0-3 month old. */
  layers: string[];
}

/** Resolves the temperature band (outdoor base for a 0-3m baby). */
function bandFor(tempC: number): Band {
  if (tempC >= 28)
    return { warmth: "heiß", tempBand: "ab 28 °C", layers: ["Windel", "Langarmbody", "dünne Hose", "dünne Socken", "Sonnenhut"] };
  if (tempC >= 23)
    return { warmth: "warm", tempBand: "23–27 °C", layers: ["Windel", "Langarmbody", "dünne Hose", "dünne Socken", "Sonnenhut"] };
  if (tempC >= 18)
    return { warmth: "mild", tempBand: "18–22 °C", layers: ["Windel", "Langarmbody", "Hose", "dünner Pullover", "dünne Socken", "dünne Mütze"] };
  if (tempC >= 13)
    return { warmth: "kühl", tempBand: "13–17 °C", layers: ["Windel", "Langarmbody", "Hose", "Pullover", "Socken", "Mütze", "leichte Jacke"] };
  if (tempC >= 8)
    return { warmth: "kalt", tempBand: "8–12 °C", layers: ["Windel", "Langarmbody", "warme Hose", "Pullover", "warme Socken", "Mütze", "Jacke"] };
  if (tempC >= 3)
    return { warmth: "kalt", tempBand: "3–7 °C", layers: ["Windel", "Langarmbody", "warme Hose", "dicker Pullover", "warme Socken", "Wintermütze", "Handschuhe", "Winterjacke"] };
  return { warmth: "frost", tempBand: "unter 3 °C", layers: ["Windel", "Langarmbody", "warme Hose", "dicker Pullover", "warme Socken", "Wintermütze", "Handschuhe", "Winteroverall"] };
}

const PROTECTED = /Windel|body/i;

/** Removes one removable insulation layer, preferring the outermost. */
function removeOneLayer(layers: string[]): string[] {
  const candidate =
    layers.find((l) => /Overall|Jacke/.test(l)) ??
    layers.find((l) => /Pullover/.test(l)) ??
    [...layers].reverse().find((l) => !PROTECTED.test(l));
  if (!candidate) return layers;
  const i = layers.indexOf(candidate);
  return [...layers.slice(0, i), ...layers.slice(i + 1)];
}

/**
 * Recommends clothing layers for a baby given temperature, situation and age,
 * following the onion principle. Pure — safe for unit tests and Server
 * Components alike.
 */
export function recommendClothing(input: ClothingInput): ClothingAdvice {
  const { tempC, situation, ageBand } = input;
  const band = bandFor(tempC);

  // Age: a 0-3m baby gets one extra layer vs an older one — model by dropping
  // a layer for "4m+".
  let layers = ageBand === "4m+" ? removeOneLayer(band.layers) : [...band.layers];

  let hint: string | undefined;

  switch (situation) {
    case "kinderwagen":
      hint = "Im Kinderwagen bei Kälte zusätzlich Fußsack oder Decke.";
      break;
    case "babytrage":
      layers = removeOneLayer(layers);
      hint = "In der Trage wärmt dein Körper mit – eine Schicht weniger. Denk an Mütze und Söckchen.";
      break;
    case "auto":
      layers = layers.filter((l) => !/Jacke|Overall/.test(l));
      hint = "Im Auto keine dicke Jacke oder Overall – sonst sitzt der Gurt nicht sicher. Wärme lieber über eine Decke über den Gurten.";
      break;
    case "schlafen":
      layers = ["Windel", "Langarmbody"];
      if (band.warmth === "kalt" || band.warmth === "frost") layers.push("Schlafanzug");
      layers.push("Schlafsack");
      hint = "Zum Schlafen ein Schlafsack passend zur Temperatur – keine losen Decken im Bett.";
      break;
    case "zuhause":
      layers = layers.filter((l) => !/Jacke|Overall|Sonnenhut|Mütze|Handschuhe|Fußsack/.test(l));
      break;
    case "allgemein":
      if (band.warmth === "heiß" || band.warmth === "warm") {
        hint = "Nicht in die direkte Sonne – Schatten suchen, dünne lange Sachen schützen vor UV.";
      }
      break;
  }

  return { tempBand: band.tempBand, layers, warmth: band.warmth, hint };
}
