// Rezept-Ideen via Claude (OAuth-Abo, kein API-Key): ruft die `claude` CLI
// headless auf und lässt sie neue Rezeptvorschläge als JSON liefern.
// Die reine Logik (Prompt-Bau, Antwort-Parsing, Umformung) ist hier getestet;
// der CLI-Aufruf ist ein dünner, ungetesteter Integrations-Wrapper.
//
// Angenommene Ideen laufen über dieselbe Schiene wie der Link-Import:
// `recipeIdeaToImported` → `upsertImportedRecipe` (repositories/recipes.ts).

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

import type { Rating } from "@/lib/services/recipeVault";
import type { ImportedRecipe } from "@/lib/services/recipeImport";
import { slugFromName } from "@/lib/services/recipeImport";
import { splitSteps } from "@/lib/services/recipeForm";

export interface RecipeIdeaIngredient {
  name: string;
  amount: string | null;
  unit: string | null;
}

export interface RecipeIdea {
  name: string;
  rating: Rating;
  simple: boolean;
  reheatable: boolean;
  tags: string[];
  ingredients: RecipeIdeaIngredient[];
  steps?: string;
}

const RATINGS: Rating[] = ["favorit", "ok", "selten"];

export interface BuildIdeasOptions {
  count: number;
  /** Optional Kontext, z.B. "Elternzeit – möglichst einfach" oder Saison. */
  context?: string;
}

/** Baut den Prompt: Bestandsnamen (gegen Dubletten) + striktes JSON-Schema. */
export function buildIdeasPrompt(existingNames: string[], opts: BuildIdeasOptions): string {
  const existing = existingNames.length
    ? existingNames.map((n) => `- ${n}`).join("\n")
    : "(noch keine)";
  const context = opts.context ? `\nKontext: ${opts.context}` : "";
  return [
    `Schlage ${opts.count} neue, alltagstaugliche Familienrezepte vor.`,
    context,
    "",
    "Diese Rezepte gibt es schon – NICHT wiederholen oder leicht abwandeln:",
    existing,
    "",
    "Antworte mit NICHTS außer einem JSON-Array. Jedes Element:",
    '{ "name": string, "rating": "favorit"|"ok"|"selten", "simple": boolean,',
    '  "reheatable": boolean, "tags": string[],',
    '  "ingredients": [{ "name": string, "amount": string|null, "unit": string|null }],',
    '  "steps": string }',
    "",
    "Mengen für 4 Personen.",
  ].join("\n");
}

function coerceIngredient(raw: unknown): RecipeIdeaIngredient | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (!name) return null;
  return {
    name,
    amount: e.amount == null ? null : String(e.amount),
    unit: e.unit == null ? null : String(e.unit),
  };
}

function coerceIdea(raw: unknown): RecipeIdea | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (!name) return null;
  const rating = RATINGS.includes(e.rating as Rating) ? (e.rating as Rating) : "ok";
  const ingredients = Array.isArray(e.ingredients)
    ? e.ingredients.map(coerceIngredient).filter((i): i is RecipeIdeaIngredient => i !== null)
    : [];
  return {
    name,
    rating,
    simple: typeof e.simple === "boolean" ? e.simple : true,
    reheatable: typeof e.reheatable === "boolean" ? e.reheatable : false,
    tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
    ingredients,
    steps: typeof e.steps === "string" ? e.steps : undefined,
  };
}

/** Extrahiert das erste JSON-Array aus der (evtl. mit Prosa/Fences) Antwort. */
export function parseIdeasResponse(raw: string): RecipeIdea[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(coerceIdea).filter((i): i is RecipeIdea => i !== null);
}

/** Der Prompt verlangt Mengen für vier Personen — damit rechnet der Portionsregler. */
const IDEA_SERVINGS = 4;

/**
 * Idee → importierbares Rezept, damit angenommene Vorschläge denselben Weg in
 * die DB nehmen wie der Link-Import (inkl. Dedupe über den Slug).
 *
 * `source` bleibt `null`: „claude" ist keine Quell-URL, und ein erfundener
 * Wert würde die Dedupe-Prüfung des Importers durcheinanderbringen.
 */
export function recipeIdeaToImported(idea: RecipeIdea): ImportedRecipe {
  return {
    slug: slugFromName(idea.name),
    name: idea.name,
    rating: idea.rating,
    simple: idea.simple,
    reheatable: idea.reheatable,
    tags: idea.tags,
    source: null,
    imageUrl: null, // Claude liefert Text, kein Bild

    servings: IDEA_SERVINGS,
    prepMinutes: null,
    cookMinutes: null,
    kcal: null,
    protein: null,
    ingredients: idea.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })),
    steps: splitSteps(idea.steps ?? ""),
  };
}

// ---- Integration (ungetestet, dünn) ----

/**
 * Ruft die `claude` CLI headless auf (OAuth-Abo). Wirft bei Fehler/Timeout.
 * Der Prompt geht via **stdin** rein (nicht argv) — vermeidet Quoting-Probleme
 * mit mehrzeiligen Prompts plattformübergreifend. Nur Flags stehen in argv,
 * daher ist `shell:true` (Windows: `claude.cmd` auflösen) hier ungefährlich.
 */
function runClaude(prompt: string, timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--output-format", "json", "--model", "claude-sonnet-4-6"],
      { cwd: tmpdir(), shell: process.platform === "win32" }, // tmp-cwd: kein Repo-Context
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("claude CLI Timeout"));
    }, timeoutMs);
    child.stdin.on("error", () => {}); // EPIPE schlucken, falls Kind früh stirbt
    child.stdin.write(prompt);
    child.stdin.end();
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exit ${code}: ${err.slice(0, 500)}`));
      try {
        resolve(String(JSON.parse(out).result ?? ""));
      } catch {
        reject(new Error("claude CLI: unerwartetes Ausgabeformat"));
      }
    });
  });
}

/** Generiert Ideen (kein DB-Write — nur Vorschläge zurück). */
export async function generateRecipeIdeas(
  existingNames: string[],
  opts: BuildIdeasOptions,
): Promise<RecipeIdea[]> {
  const result = await runClaude(buildIdeasPrompt(existingNames, opts));
  return parseIdeasResponse(result);
}
