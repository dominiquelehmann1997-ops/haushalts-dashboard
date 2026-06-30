// Rezept-Ideen via Claude (OAuth-Abo, kein API-Key): ruft die `claude` CLI
// headless auf, lässt sie neue Rezeptvorschläge als JSON liefern, und
// serialisiert angenommene Ideen ins Vault-Markdown-Format (recipeVault).
// Die reine Logik (Prompt-Bau, Antwort-Parsing, Markdown) ist hier getestet;
// der CLI-Aufruf + Datei-Write sind dünne, ungetestete Integrations-Wrapper.

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { Rating } from "@/lib/services/recipeVault";
import { slugFromFilename } from "@/lib/services/recipeVault";

export interface RecipeIdeaIngredient {
  name: string;
  amount: string | null;
  unit: string | null;
  category: "frisch" | "haltbar" | null;
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
    '  "ingredients": [{ "name": string, "amount": string|null, "unit": string|null,',
    '    "freshness": "frisch"|"haltbar" }],',
    '  "steps": string }',
    "",
    'Mengen für 4 Personen. "freshness" = haltbar (Vorrat) oder frisch (kühl/Obst/Gemüse).',
  ].join("\n");
}

function coerceIngredient(raw: unknown): RecipeIdeaIngredient | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (!name) return null;
  const fresh = e.freshness ?? e.category;
  return {
    name,
    amount: e.amount == null ? null : String(e.amount),
    unit: e.unit == null ? null : String(e.unit),
    category: fresh === "frisch" || fresh === "haltbar" ? fresh : null,
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

/** Serialisiert eine Idee ins Vault-Markdown (round-trips durch parseRecipeMarkdown). */
export function recipeIdeaToVaultMarkdown(idea: RecipeIdea): string {
  const slug = slugFromFilename(idea.name);
  const lines: string[] = [
    "---",
    `id: ${slug}`,
    `name: ${JSON.stringify(idea.name)}`,
    `rating: ${idea.rating}`,
    `simple: ${idea.simple}`,
    `reheatable: ${idea.reheatable}`,
    "source: claude",
    `tags: ${JSON.stringify(idea.tags)}`,
    "ingredients:",
  ];
  for (const ing of idea.ingredients) {
    lines.push(`  - name: ${JSON.stringify(ing.name)}`);
    if (ing.amount != null) lines.push(`    amount: ${JSON.stringify(ing.amount)}`);
    if (ing.unit != null) lines.push(`    unit: ${JSON.stringify(ing.unit)}`);
    if (ing.category != null) lines.push(`    freshness: ${ing.category}`);
  }
  lines.push("---", "");
  if (idea.steps) lines.push(idea.steps, "");
  return lines.join("\n");
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

/** Generiert Ideen (kein DB/Vault-Write — nur Vorschläge zurück). */
export async function generateRecipeIdeas(
  existingNames: string[],
  opts: BuildIdeasOptions,
): Promise<RecipeIdea[]> {
  const result = await runClaude(buildIdeasPrompt(existingNames, opts));
  return parseIdeasResponse(result);
}

/** Schreibt eine angenommene Idee als `.md` in den Vault. Gibt den Dateipfad zurück. */
export async function saveRecipeIdeaToVault(idea: RecipeIdea, vaultPath: string): Promise<string> {
  const file = path.join(vaultPath, `${slugFromFilename(idea.name)}.md`);
  await writeFile(file, recipeIdeaToVaultMarkdown(idea), "utf8");
  return file;
}
