// Rezept-Extraktion aus Rohtext (OCR von Rezeptkarten, Social-Media-Captions)
// via `claude -p` über das Abo. Web-Links laufen NICHT hier durch — die löst
// `recipeImport.ts` ohne LLM aus dem schema.org-Markup.
//
// Die Regeln im Prompt sind aus ObsidiDine übernommen (ExtractionPrompt.kt)
// und an echten Instagram- und TikTok-Captions getunt. Nicht umformulieren,
// ohne an denselben Quellen gegenzuprüfen.

import { normalizeCategory } from "@/lib/domain";
import { runClaude } from "@/lib/services/claudeCli";
import { withVegetarianTag } from "@/lib/services/vegetarianTag";
import { slugFromName, type ImportedRecipe } from "@/lib/services/recipeImport";

export const MAX_INPUT_CHARS = 6000;

/**
 * Budget für die **komplette** Extraktion, also Erstversuch UND Repair-Retry
 * zusammen — nicht pro CLI-Aufruf. Zwei Aufrufe mit je eigenem Timeout hätten
 * zusammen länger gebraucht als der Cloudflare-Tunnel (~100s) und der
 * Android-Client (callTimeout 120s) warten: dann gewinnt immer die Gegenseite
 * und unsere Fehlermeldung (claude CLI HTTP 401, "keine Rezeptdaten" o.ä.)
 * kommt nie an, obwohl das Abo-Kontingent schon verbraucht ist.
 *
 * Nur hier gesetzt, nicht am Default von `runClaude` — die Rezept-Ideen
 * (`recipeIdeas.ts`) laufen ohne UI-Wettlauf und behalten ihr Budget.
 */
const EXTRACTION_BUDGET_MS = 90_000;

export interface ExtractedIngredient {
  name: string;
  amount?: string | null;
  unit?: string | null;
  section?: string | null;
}

export interface ExtractedNutrition {
  basis?: string | null;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

export interface ExtractedRecipe {
  name: string;
  tags?: string[];
  category?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients: ExtractedIngredient[];
  steps: string[];
  nutrition?: ExtractedNutrition | null;
}

export const EXTRACTION_PROMPT = `
Du extrahierst Kochrezepte aus rohem Text (OCR-Ergebnisse, Social-Media-Captions).
Antworte mit NICHTS außer einem JSON-Objekt. Sprache: Deutsch.
Regeln:
- ÜBERSETZEN: Ist das Rezept nicht auf Deutsch (z.B. Englisch), übersetze ALLES
  ins Deutsche — "name", Zutaten-Namen inkl. "section", "steps", "tags",
  "nutrition.basis".
  Nichts in der Ausgabe darf in einer anderen Sprache bleiben.
- METRISCH UMRECHNEN: Wandle US-/imperiale Mengen in europäische metrische Einheiten um.
  Runde auf küchentaugliche Werte. Umrechnungen:
    • lb/lbs/pound → g (1 lb ≈ 454 g), oz/ounce (Gewicht) → g (1 oz ≈ 28 g)
    • fl oz → ml (1 fl oz ≈ 30 ml), cup → ml bei Flüssigem (1 cup ≈ 240 ml)
    • stick Butter → g (1 stick ≈ 113 g)
    • tsp/teaspoon → TL, tbsp/Tbsp/tablespoon → EL
    • °F → °C (auch in "steps"!): °C = (°F − 32) × 5/9, auf 5er gerundet (z.B. 400°F → 200°C)
    • inch → cm (1 inch ≈ 2,5 cm)
  "to taste" → weglassen (kein amount), "a little"/"a pinch" → unit "Prise" ohne amount.
- "amount" immer als String: ganze Zahlen "400", Dezimal "1.5", Brüche "1/2", Bereiche "2-3".
- "unit" separat: g, kg, ml, l, EL, TL, Stk, Prise, Bund.
- ZUTATEN-GRUPPEN: Jede Zeile in der Zutatenliste, die KEINE Zutat mit Menge ist, sondern
  einen Teil des Gerichts benennt, ist eine Gruppenüberschrift — mit ODER ohne
  Doppelpunkt, ein einzelnes Wort genügt. Beispiele: "Für die Nuggets:", "Für die Soße:",
  "Dip", "Sauce", "Teig", "Topping", "Marinade", "Füllung", "Zum Servieren".
  Setze bei JEDER Zutat unterhalb einer solchen Zeile "section" auf diese Überschrift
  (ohne Doppelpunkt, Schreibweise der Quelle). Die Überschrift selbst NIEMALS als Zutat
  ausgeben. Zutaten oberhalb der ersten Überschrift bleiben ohne "section".
  Keine Gruppen sind Zeilen wie "Zutaten", "Zutaten für 2 Personen", "Rezept",
  "Zubereitung". Reihenfolge der Zutaten nicht verändern. Fehlen solche Zeilen,
  "section" überall weglassen — keine Gruppen erfinden.
- "steps": Jeden Zubereitungsschritt knapp fassen, ein bis zwei Sätze. Sind
  Schrittnummern im Text, danach sortieren, die Nummern aber nicht in den
  Ausgabetext übernehmen.
- KATEGORIE: "category" ist "hauptmahlzeit" für richtige Gerichte,
  "snack" für Kleinigkeiten zwischendurch (Riegel, Bites, Dips, Aufstriche),
  "suesses" für Süßspeisen und Gebäck (Kuchen, Kekse, Desserts, Eis).
  Im Zweifel "hauptmahlzeit".
- "nutrition" nur befüllen, wenn Nährwerte im Text explizit genannt sind: kcal (Energie),
  protein/carbs/fat in Gramm (nur Zahl, ohne Einheit). Nährwerte niemals schätzen oder
  berechnen.
- "nutrition.basis" wörtlich übernehmen, wie es im Text steht ("pro Portion",
  "pro 100g"). Niemals raten und niemals umrechnen.
- Unbekannte Felder weglassen bzw. auf null setzen. Nichts erfinden.

Format:
{ "name": string, "tags": string[], "category": string, "servings": number|null,
  "prepMinutes": number|null, "cookMinutes": number|null,
  "ingredients": [{ "name": string, "amount": string|null, "unit": string|null,
                    "section": string|null }],
  "steps": string[],
  "nutrition": { "basis": string|null, "kcal": number|null, "protein": number|null,
                 "carbs": number|null, "fat": number|null } | null }
`.trim();

export function buildExtractionPrompt(rawText: string, repairHint?: string | null): string {
  const capped = rawText.slice(0, MAX_INPUT_CHARS);
  const repair = repairHint
    ? `\n\nDein letzter Versuch war ungültig. Fehler: ${repairHint}\nKorrigiere genau diese Punkte.`
    : "";
  return `${EXTRACTION_PROMPT}\n\nExtrahiere das Rezept aus folgendem Text:\n\n${capped}${repair}`;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Nährwerte landen als ganze Gramm bzw. kcal in der DB — wie `protein` seit jeher. */
function roundOrNull(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value);
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function coerceIngredient(raw: unknown): ExtractedIngredient | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (name === "") return null;
  return {
    name,
    amount: e.amount == null ? null : String(e.amount),
    unit: textOrNull(e.unit),
    section: textOrNull(e.section),
  };
}

function coerceNutrition(raw: unknown): ExtractedNutrition | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const nutrition: ExtractedNutrition = {
    basis: textOrNull(e.basis),
    kcal: numberOrNull(e.kcal),
    protein: numberOrNull(e.protein),
    carbs: numberOrNull(e.carbs),
    fat: numberOrNull(e.fat),
  };
  const empty =
    nutrition.kcal === null &&
    nutrition.protein === null &&
    nutrition.carbs === null &&
    nutrition.fat === null;
  return empty ? null : nutrition;
}

/**
 * Position des zu `text[start]` (einer "{") passenden "}", oder -1.
 * Klammern innerhalb von String-Literalen zählen nicht mit — ein
 * Rezeptname wie "Currywurst {Deluxe}" würde sonst die Zählung
 * durcheinanderbringen. Escapte Anführungszeichen ("\"" im String)
 * dürfen das String-Ende nicht vortäuschen, sonst kippt die Zählung ab
 * dem nächsten Zeichen.
 */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Höchstens so viele Klammer-Kandidaten pro Textabschnitt probieren. Ohne
 * Deckel würde ein pathologischer Text voller Streu-Klammern die Suche zu
 * einem quadratischen Scan machen (pro Kandidat bis zu O(n) Zeichen); mit
 * Deckel bleibt es O(cap · n). Reale Modell-Antworten haben höchstens eine
 * Handvoll Klammerstücke, 20 ist großzügig bemessen.
 */
const MAX_JSON_CANDIDATES = 20;

/**
 * Sucht in `text` nacheinander jedes klammer-balancierte Top-Level-Stück und
 * liefert das erste, das sich als JSON-Objekt parsen lässt — `null`, wenn
 * keins passt. Ein Kandidat ohne Gegenstück (z.B. eine einzelne offene "{"
 * in der Prosa vor dem echten JSON) wird übersprungen statt die Suche
 * abzubrechen: sonst reicht eine kaputte Klammer irgendwo im Text, um ein
 * daneben stehendes, sauberes Rezept zu verwerfen.
 */
function firstJsonObject(text: string): unknown {
  let from = 0;
  for (let tries = 0; tries < MAX_JSON_CANDIDATES; tries++) {
    const start = text.indexOf("{", from);
    if (start === -1) return null;
    const end = findMatchingBrace(text, start);
    if (end === -1) {
      from = start + 1; // Klammer ohne Gegenstück — ab der nächsten "{" weitersuchen
      continue;
    }
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      from = end + 1; // kein gültiges JSON — nächstes Klammerstück versuchen
    }
  }
  return null;
}

/**
 * Zieht das JSON-Objekt aus einer Antwort, die Claude mit Prosa oder Fences
 * garniert haben kann. Ein naives "erstes { bis letztes }" reißt dabei auch
 * Prosa-Klammern wie "Bitte beachte {Hinweis}" mit ins Ergebnis und
 * JSON.parse schlägt fehl — deshalb: zuerst einen Fenced-Code-Block
 * bevorzugen (dort schreibt das Modell das JSON hin, wenn es auch Prosa
 * dazuschreibt); steht dort kein gültiges JSON (Fence mit Kommentar/Müll
 * statt Rezept), auf den kompletten Rohtext ausweichen statt aufzugeben.
 */
function extractJsonPayload(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const fromFence = firstJsonObject(fence[1]);
    if (fromFence !== null) return fromFence;
  }
  return firstJsonObject(raw);
}

/** Erstes JSON-Objekt aus der (evtl. mit Prosa/Fences garnierten) Antwort. */
export function parseExtractionResponse(raw: string): ExtractedRecipe | null {
  const parsed = extractJsonPayload(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const e = parsed as Record<string, unknown>;
  if (typeof e.name !== "string") return null;
  return {
    name: e.name,
    tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
    category: typeof e.category === "string" ? e.category : null,
    servings: numberOrNull(e.servings),
    prepMinutes: numberOrNull(e.prepMinutes),
    cookMinutes: numberOrNull(e.cookMinutes),
    ingredients: Array.isArray(e.ingredients)
      ? e.ingredients.map(coerceIngredient).filter((i): i is ExtractedIngredient => i !== null)
      : [],
    steps: Array.isArray(e.steps) ? e.steps.map(String).filter((s) => s.trim() !== "") : [],
    nutrition: coerceNutrition(e.nutrition),
  };
}

/** Nur "pro Portion" zählt. Die DB hat kein Basis-Feld; 100g-Werte wären dort schlicht falsch. */
function isPerServing(basis: string | null | undefined): boolean {
  if (!basis) return true; // keine Angabe: die Quelle meint fast immer die Portion
  const b = basis.toLowerCase();
  if (/100\s*(g|ml)/.test(b)) return false;
  return /portion|serving|stück|person/.test(b) || b.trim() === "";
}

export function toImportedFromExtraction(
  e: ExtractedRecipe,
  sourceUrl: string | null,
): ImportedRecipe {
  const ingredients = e.ingredients.map((i) => ({
    name: i.name,
    amount: i.amount ?? null,
    unit: i.unit ?? null,
    section: i.section ?? null,
  }));
  const n = isPerServing(e.nutrition?.basis) ? e.nutrition : null;
  return {
    slug: slugFromName(e.name),
    name: e.name,
    rating: "ok", // Haushaltsentscheidung, nicht Sache der Quelle
    simple: true,
    reheatable: false,
    category: normalizeCategory(e.category),
    tags: withVegetarianTag(e.tags ?? [], ingredients),
    source: sourceUrl,
    imageUrl: null, // aus Rohtext kommt kein Bild
    servings: e.servings ?? null,
    prepMinutes: e.prepMinutes ?? null,
    cookMinutes: e.cookMinutes ?? null,
    kcal: roundOrNull(n?.kcal),
    protein: roundOrNull(n?.protein),
    carbs: roundOrNull(n?.carbs),
    fat: roundOrNull(n?.fat),
    ingredients,
    steps: e.steps,
  };
}

/** Was ein Rezept haben muss, um überhaupt speicherbar zu sein. */
export function problemsOf(recipe: ImportedRecipe): string[] {
  const problems: string[] = [];
  if (recipe.name.trim() === "" || recipe.slug === "") {
    problems.push(`Name "${recipe.name}" ergibt keinen gültigen Slug`);
  }
  if (recipe.ingredients.length === 0) problems.push("Keine Zutaten erkannt");
  if (recipe.steps.length === 0) problems.push("Keine Zubereitungsschritte erkannt");
  return problems;
}

/**
 * Rohtext → validiertes `ImportedRecipe`. Höchstens zwei CLI-Aufrufe:
 * die Extraktion und ein Repair-Retry mit den konkreten Mängeln als Hinweis.
 */
export async function extractRecipeFromText(
  rawText: string,
  sourceUrl: string | null = null,
): Promise<ImportedRecipe> {
  if (rawText.trim() === "") throw new Error("Kein Text zum Auswerten übergeben.");

  // Beide Aufrufe teilen sich EIN Zeitbudget: was der Erstversuch verbraucht,
  // fehlt dem Retry.
  const deadline = Date.now() + EXTRACTION_BUDGET_MS;

  const first = parseExtractionResponse(
    await runClaude(buildExtractionPrompt(rawText), { timeoutMs: EXTRACTION_BUDGET_MS }),
  );
  const firstProblems = first
    ? problemsOf(toImportedFromExtraction(first, sourceUrl))
    : ["Antwort enthielt kein lesbares JSON"];
  if (first && firstProblems.length === 0) return toImportedFromExtraction(first, sourceUrl);

  // Zu wenig Rest für einen zweiten Anlauf: lieber jetzt mit dem konkreten Mangel
  // scheitern, als den Client in den Netzwerk-Timeout laufen zu lassen.
  const remaining = deadline - Date.now();
  if (remaining < 10_000) {
    throw new Error(`Extraktion bleibt unvollständig: ${firstProblems.join("; ")}`);
  }

  const second = parseExtractionResponse(
    await runClaude(buildExtractionPrompt(rawText, firstProblems.join("; ")), {
      timeoutMs: remaining,
    }),
  );
  if (!second) throw new Error("Aus dem Text ließ sich kein Rezept lesen.");
  const recipe = toImportedFromExtraction(second, sourceUrl);
  const problems = problemsOf(recipe);
  if (problems.length > 0) {
    throw new Error(`Extraktion bleibt unvollständig: ${problems.join("; ")}`);
  }
  return recipe;
}
