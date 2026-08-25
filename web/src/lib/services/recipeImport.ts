// Rezept-Import per Link: holt eine Rezept-Seite, liest deren schema.org-
// Rezeptdaten (JSON-LD, das Google-Rich-Result-Markup — praktisch jede große
// Rezeptseite liefert es) und schreibt daraus eine vertragskonforme `.md` in
// den Obsidian-Vault (siehe docs/recipe-vault-import-contract.md).
//
// Kein LLM, keine API-Keys, keine Kosten: die Seiten liefern die Zutaten und
// Schritte bereits strukturiert aus. Die reine Logik (Extraktion, Zutaten-
// Parsing, Markdown) ist hier getestet; Fetch + Datei-Write sind dünne,
// ungetestete Integrations-Wrapper (wie in recipeIdeas.ts).

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import type { Rating } from "@/lib/services/recipeVault";

/** Was aus der Seite geholt und in den Vault geschrieben wird. */
export interface ImportedIngredient {
  name: string;
  amount?: string | null;
  unit?: string | null;
}

export interface ImportedRecipe {
  id: string;
  name: string;
  rating: Rating;
  simple: boolean;
  reheatable: boolean;
  tags: string[];
  source: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  kcal: number | null;
  protein: number | null;
  ingredients: ImportedIngredient[];
  steps: string[];
}

// ── HTML-Kleinkram ───────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  szlig: "ß",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  ntilde: "ñ",
  deg: "°",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  times: "×",
  rsquo: "'",
  lsquo: "'",
  ldquo: '"',
  rdquo: '"',
  // Bruch-Entities: manche Seiten schreiben "&frac12; TL" statt "½ TL".
  frac12: "½",
  frac13: "⅓",
  frac23: "⅔",
  frac14: "¼",
  frac34: "¾",
  frac18: "⅛",
};

/** Dekodiert die HTML-Entities, die in Rezepttexten real vorkommen. */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    // Ziffern gehören zum Namen (`&frac12;`), daher nicht nur [a-z].
    .replace(/&([a-z][a-z0-9]*);/gi, (match, name: string) => ENTITIES[name] ?? match);
}

/** Entfernt HTML-Tags aus einem Textfeld und normalisiert Whitespace. */
export function stripHtml(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// ── schema.org-Extraktion ────────────────────────────────────────────────────

type Json = Record<string, unknown>;

function isRecipeNode(node: unknown): node is Json {
  if (!node || typeof node !== "object") return false;
  const type = (node as Json)["@type"];
  if (typeof type === "string") return type.toLowerCase() === "recipe";
  if (Array.isArray(type)) return type.some((t) => String(t).toLowerCase() === "recipe");
  return false;
}

/** Läuft durch verschachtelte JSON-LD-Strukturen (`@graph`, Arrays) und
 *  liefert den ersten Recipe-Knoten. */
function findRecipeNode(value: unknown, depth = 0): Json | null {
  if (depth > 6 || !value || typeof value !== "object") return null;
  if (isRecipeNode(value)) return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const hit = findRecipeNode(entry, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  for (const nested of Object.values(value as Json)) {
    if (nested && typeof nested === "object") {
      const hit = findRecipeNode(nested, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Zieht den schema.org-Recipe-Knoten aus dem HTML einer Rezeptseite.
 * `null`, wenn die Seite kein (lesbares) Rezept-JSON-LD enthält.
 */
export function extractRecipeSchema(html: string): Json | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // kaputtes JSON-LD auf der Seite → nächster Block
    }
    const recipe = findRecipeNode(parsed);
    if (recipe) return recipe;
  }
  return null;
}

// ── Feld-Parser ──────────────────────────────────────────────────────────────

const FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅙": "1/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

/** Deutsche Einheiten → kanonische Schreibweise (Key ist lowercase, ohne Punkt). */
const UNITS: Record<string, string> = {
  g: "g",
  gramm: "g",
  kg: "kg",
  mg: "mg",
  ml: "ml",
  l: "l",
  liter: "l",
  cl: "cl",
  el: "EL",
  esslöffel: "EL",
  tl: "TL",
  teelöffel: "TL",
  msp: "Msp",
  prise: "Prise",
  prisen: "Prise",
  pck: "Pck",
  packung: "Pck",
  packungen: "Pck",
  paket: "Pck",
  beutel: "Beutel",
  bund: "Bund",
  stück: "Stk",
  stk: "Stk",
  stange: "Stange",
  stangen: "Stange",
  scheibe: "Scheibe",
  scheiben: "Scheibe",
  zehe: "Zehe",
  zehen: "Zehe",
  blatt: "Blatt",
  blätter: "Blatt",
  zweig: "Zweig",
  zweige: "Zweig",
  dose: "Dose",
  dosen: "Dose",
  glas: "Glas",
  gläser: "Glas",
  becher: "Becher",
  tasse: "Tasse",
  tassen: "Tasse",
  flasche: "Flasche",
  kugel: "Kugel",
  kugeln: "Kugel",
  kopf: "Kopf",
  knolle: "Knolle",
  würfel: "Würfel",
  handvoll: "Handvoll",
  tropfen: "Tropfen",
  portion: "Portion",
  portionen: "Portion",
  cup: "Cup",
  cups: "Cup",
};

/** Mengen-Wörter ohne Zahl, die als `amount` erhalten bleiben sollen. */
const VAGUE_AMOUNTS = ["n. b.", "n.b.", "etwas", "nach belieben", "einige", "evtl."];

function formatGermanNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(".", ",");
}

/** "1/2" / "1 1/2" → deutsche Dezimalzahl; sonst null. */
function fractionToNumber(text: string): number | null {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const plain = text.match(/^(\d+)\/(\d+)$/);
  if (plain) return Number(plain[1]) / Number(plain[2]);
  return null;
}

/** "Zwiebel(n)" → "Zwiebel"; Whitespace normalisiert. */
function cleanIngredientName(name: string): string {
  return name
    .replace(/\((?:n|e|en|er|es|s|nen|innen)\)/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,;·•\-\s]+|[,;\s]+$/g, "")
    .trim();
}

/**
 * Zerlegt eine Zutaten-Zeile ("500 g Nudeln", "½ TL Salz", "n. B. Pfeffer")
 * in `amount`/`unit`/`name`. Nicht erkannte Mengen bleiben Teil des Namens —
 * lieber eine ungetrennte Zeile als eine falsch geratene Menge.
 */
export function parseIngredientLine(line: string): ImportedIngredient | null {
  let rest = stripHtml(line);
  for (const [glyph, fraction] of Object.entries(FRACTIONS)) {
    rest = rest.replaceAll(glyph, ` ${fraction} `);
  }
  rest = rest.replace(/\s+/g, " ").trim();
  if (!rest) return null;

  let amount: string | null = null;

  const vague = VAGUE_AMOUNTS.find((v) => rest.toLowerCase().startsWith(v));
  if (vague) {
    amount = rest.slice(0, vague.length).trim();
    rest = rest.slice(vague.length).trim();
  } else {
    // Zahl, Bereich ("2-3"), Bruch ("1/2") oder gemischter Bruch ("1 1/2").
    const match = rest.match(
      /^(?:(\d+\s+\d+\/\d+)|(\d+\/\d+)|(\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?))\s*/,
    );
    if (match) {
      const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim();
      const asFraction = fractionToNumber(raw);
      if (asFraction !== null) {
        amount = formatGermanNumber(asFraction);
      } else if (match[3]) {
        amount = raw.replace(/\s*[-–]\s*/, "-"); // Bereich bleibt Text
      } else {
        amount = raw.replace(".", ",");
      }
      rest = rest.slice(match[0].length).trim();
    }
  }

  let unit: string | null = null;
  const unitMatch = rest.match(/^(\S+)\s+(.*)$/);
  if (unitMatch) {
    const candidate = unitMatch[1].replace(/\.$/, "").toLowerCase();
    if (UNITS[candidate]) {
      unit = UNITS[candidate];
      rest = unitMatch[2].trim();
    }
  }

  const name = cleanIngredientName(rest);
  if (!name) return null;
  return { name, amount, unit };
}

/** ISO-8601-Dauer ("PT1H30M") → Minuten; null wenn nicht parsebar. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i);
  if (!match) return null;
  const minutes =
    Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return minutes > 0 ? minutes : null;
}

/** `recipeYield`: 4 | "4" | "4 Portionen" | ["4 Portionen"] → 4. */
export function parseServings(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "number" && Number.isFinite(first) && first > 0) return Math.round(first);
  if (typeof first !== "string") return null;
  const match = first.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return n > 0 ? n : null;
}

/** "540 kcal" | "540 calories" | 540 → 540. */
export function parseNutritionNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const match = value.replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  return Math.round(Number(match[0]));
}

/** Sammelt Zubereitungsschritte aus allen `recipeInstructions`-Varianten. */
export function collectSteps(value: unknown, depth = 0): string[] {
  // Tiefe 6 deckt den verschachteltsten realen Fall ab:
  // Array → HowToSection → itemListElement → HowToStep → text.
  if (depth > 6 || value == null) return [];
  if (typeof value === "string") {
    // Manche Seiten liefern einen HTML-Block oder einen Absatz-Text.
    const withBreaks = value.replace(/<\/(?:li|p|div|br)>|<br\s*\/?>/gi, "\n");
    return stripHtml(withBreaks.replace(/<[^>]*>/g, " "))
      .split(/\n+/)
      .flatMap((part) => part.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/))
      .map((s) => s.trim())
      .filter((s) => s.length > 1);
  }
  if (Array.isArray(value)) return value.flatMap((entry) => collectSteps(entry, depth + 1));
  if (typeof value === "object") {
    const node = value as Json;
    if (node.itemListElement) return collectSteps(node.itemListElement, depth + 1);
    if (typeof node.text === "string") return collectSteps(node.text, depth + 1);
    if (typeof node.name === "string") return collectSteps(node.name, depth + 1);
  }
  return [];
}

/** `keywords`/`recipeCategory`/`recipeCuisine` → normalisierte Tag-Liste. */
export function collectTags(schema: Json): string[] {
  const raw: string[] = [];
  for (const key of ["keywords", "recipeCategory", "recipeCuisine"]) {
    const value = schema[key];
    if (typeof value === "string") raw.push(...value.split(","));
    else if (Array.isArray(value)) raw.push(...value.map((v) => String(v)));
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of raw) {
    const tag = stripHtml(entry).toLowerCase().replace(/\s+/g, "-");
    if (!tag || tag.length > 30 || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length === 8) break;
  }
  return tags;
}

// ── Umlaut-sicherer Slug ─────────────────────────────────────────────────────

export const TRANSLITERATE: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  à: "a",
  á: "a",
  â: "a",
  è: "e",
  é: "e",
  ê: "e",
  ì: "i",
  í: "i",
  ò: "o",
  ó: "o",
  ô: "o",
  ù: "u",
  ú: "u",
  û: "u",
  ç: "c",
  ñ: "n",
};

/**
 * Rezeptname → stabiler kebab-case-Slug. Anders als `slugFromFilename`
 * werden Umlaute transliteriert ("Gemüse" → "gemuese" statt "gem-se").
 * Der Slug ist der Identitäts-Anker im Vault und wird nie nachträglich
 * geändert (siehe Import-Contract §3).
 */
export function slugFromName(name: string): string {
  const lowered = name.toLowerCase();
  let out = "";
  for (const char of lowered) out += TRANSLITERATE[char] ?? char;
  return out
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Rezeptname → Dateiname (Obsidian zeigt ihn als Notiztitel). */
export function fileNameFromRecipe(name: string, slug: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^_+/, "") // führender "_" würde vom Ingest übersprungen
    .slice(0, 90)
    .trim();
  return `${safe || slug}.md`;
}

// ── schema.org → Vault-Rezept ────────────────────────────────────────────────

/** Ab hier gilt ein Gericht nicht mehr als "einfach" (Alltagstauglichkeit). */
const SIMPLE_MAX_MINUTES = 45;
const SIMPLE_MAX_INGREDIENTS = 12;
/** kcal/Portion, bis zu der automatisch der Tag "kalorienarm" gesetzt wird. */
const LOW_CALORIE_MAX_KCAL = 500;

/**
 * Baut aus dem schema.org-Knoten das Vault-Rezept. `sourceUrl` landet als
 * `source` im Frontmatter (vom Dashboard ignoriert, aber der Anker, über den
 * ein erneuter Import dieselbe Notiz aktualisiert statt sie zu duplizieren).
 */
export function toImportedRecipe(schema: Json, sourceUrl: string): ImportedRecipe {
  const rawName = typeof schema.name === "string" ? stripHtml(schema.name) : "";
  if (!rawName) throw new Error("Die Seite liefert ein Rezept ohne Namen.");

  const ingredients = (Array.isArray(schema.recipeIngredient) ? schema.recipeIngredient : [])
    .map((entry) => parseIngredientLine(String(entry)))
    .filter((i): i is ImportedIngredient => i !== null);

  const prepMinutes = parseIsoDuration(schema.prepTime);
  const cookMinutes = parseIsoDuration(schema.cookTime);
  const totalMinutes = parseIsoDuration(schema.totalTime) ?? (prepMinutes ?? 0) + (cookMinutes ?? 0);

  const nutrition = (schema.nutrition ?? {}) as Json;
  const kcal = parseNutritionNumber(nutrition.calories);
  const protein = parseNutritionNumber(nutrition.proteinContent);

  const tags = collectTags(schema);
  if (kcal !== null && kcal <= LOW_CALORIE_MAX_KCAL && !tags.includes("kalorienarm")) {
    tags.unshift("kalorienarm");
  }

  const simple =
    (totalMinutes === 0 || totalMinutes <= SIMPLE_MAX_MINUTES) &&
    ingredients.length <= SIMPLE_MAX_INGREDIENTS;

  return {
    id: slugFromName(rawName),
    name: rawName,
    rating: "ok", // bewusst neutral: Bewertung vergibt der Haushalt selbst
    simple,
    reheatable: false,
    tags: tags.slice(0, 8),
    source: sourceUrl,
    servings: parseServings(schema.recipeYield),
    prepMinutes,
    cookMinutes,
    kcal,
    protein,
    ingredients,
    steps: collectSteps(schema.recipeInstructions),
  };
}

/**
 * Serialisiert das Rezept als Vault-Markdown (YAML via gray-matter, damit die
 * Ausgabe garantiert durch `parseRecipeMarkdown` zurückläuft).
 */
export function importedRecipeToVaultMarkdown(recipe: ImportedRecipe): string {
  const nutrition: Record<string, number> = {};
  if (recipe.kcal !== null) nutrition.kcal = recipe.kcal;
  if (recipe.protein !== null) nutrition.protein = recipe.protein;

  const frontmatter: Record<string, unknown> = {
    id: recipe.id,
    name: recipe.name,
    rating: recipe.rating,
    simple: recipe.simple,
    reheatable: recipe.reheatable,
    source: recipe.source,
  };
  if (recipe.tags.length > 0) frontmatter.tags = recipe.tags;
  if (recipe.servings !== null) frontmatter.servings = recipe.servings;
  if (recipe.prepMinutes !== null) frontmatter.prepMinutes = recipe.prepMinutes;
  if (recipe.cookMinutes !== null) frontmatter.cookMinutes = recipe.cookMinutes;
  if (Object.keys(nutrition).length > 0) frontmatter.nutrition = nutrition;
  frontmatter.ingredients = recipe.ingredients.map((i) => ({
    name: i.name,
    ...(i.amount != null ? { amount: i.amount } : {}),
    ...(i.unit != null ? { unit: i.unit } : {}),
  }));

  const body = [
    "## Zubereitung",
    "",
    ...(recipe.steps.length > 0
      ? recipe.steps.map((step, index) => `${index + 1}. ${step}`)
      : ["_(Die Seite liefert keine maschinenlesbaren Schritte — siehe Quelle.)_"]),
    "",
    "## Quelle",
    "",
    recipe.source,
    "",
  ].join("\n");

  return matter.stringify(body, frontmatter);
}

// ---- Integration (ungetestet, dünn) ----

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/** Holt das HTML einer Rezeptseite. Wirft bei Netzfehler/HTTP-Fehler. */
export async function fetchRecipePage(url: string, timeoutMs = 20_000): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Seite antwortet mit HTTP ${response.status}.`);
  return response.text();
}

/** Prüft grob, ob die Eingabe eine http(s)-URL ist. */
export function normalizeRecipeUrl(input: string): string {
  const trimmed = input.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Das ist keine gültige URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Nur http(s)-Links werden unterstützt.");
  }
  return parsed.toString();
}

/**
 * Sucht im Vault eine Notiz, die dasselbe Rezept meint — gleiche Quell-URL
 * oder gleiche `id`. So aktualisiert ein erneuter Import dieselbe Datei,
 * statt ein zweites Rezept mit demselben Slug anzulegen (Contract §3).
 */
async function findExistingRecipeFile(
  vaultPath: string,
  recipe: ImportedRecipe,
): Promise<{ file: string; id: string } | null> {
  let files: string[];
  try {
    files = (await readdir(vaultPath)).filter(
      (f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"),
    );
  } catch {
    return null;
  }

  for (const file of files) {
    let data: Record<string, unknown>;
    try {
      data = matter(await readFile(path.join(vaultPath, file), "utf8")).data;
    } catch {
      continue;
    }
    const id = typeof data.id === "string" ? data.id.trim() : "";
    const source = typeof data.source === "string" ? data.source.trim() : "";
    if ((source && source === recipe.source) || (id && id === recipe.id)) {
      return { file, id: id || recipe.id };
    }
  }
  return null;
}

export interface ImportResult {
  recipe: ImportedRecipe;
  /** Absoluter Pfad der geschriebenen `.md`. */
  file: string;
  /** true, wenn eine bestehende Notiz aktualisiert wurde. */
  updated: boolean;
}

/**
 * Kompletter Link-Import: URL holen → schema.org lesen → `.md` in den Vault
 * schreiben. Spiegelt **nicht** in die DB — das macht wie immer `ingestVault`
 * (Vault = Wahrheit, DB = Cache).
 */
export async function importRecipeFromUrl(
  rawUrl: string,
  vaultPath: string,
): Promise<ImportResult> {
  const url = normalizeRecipeUrl(rawUrl);
  const html = await fetchRecipePage(url);
  const schema = extractRecipeSchema(html);
  if (!schema) {
    throw new Error(
      "Die Seite liefert keine schema.org-Rezeptdaten — hier hilft nur der Obsidian Web Clipper.",
    );
  }

  const recipe = toImportedRecipe(schema, url);
  const existing = await findExistingRecipeFile(vaultPath, recipe);
  // Bestehende `id` gewinnt: der Slug ist der Identitäts-Anker und darf sich
  // nie ändern, auch wenn die Seite den Rezeptnamen inzwischen umbenannt hat.
  if (existing) recipe.id = existing.id;

  const file = path.join(vaultPath, existing?.file ?? fileNameFromRecipe(recipe.name, recipe.id));
  await writeFile(file, importedRecipeToVaultMarkdown(recipe), "utf8");
  return { recipe, file, updated: existing !== null };
}
