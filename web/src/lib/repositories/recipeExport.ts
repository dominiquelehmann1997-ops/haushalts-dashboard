// Rezept-Backup: schreibt jedes Rezept als Markdown-Datei nach
// `RECIPE_EXPORT_PATH`. Aufgerufen von `prisma/exportRecipes.ts`
// (`npm run export:recipes`), nächtlich über `scripts/tablet-backup.sh`.
//
// Das ist die menschenlesbare Hälfte des Backups — die maschinelle ist die
// datierte `prod.db`-Kopie, die dasselbe Script daneben legt. Diese Dateien
// sind zum Nachlesen und Wieder-Eintippen da, nicht zum Zurückspielen.
//
// `RECIPE_EXPORT_PATH` darf der alte Obsidian-Vault-Ordner sein: dann nimmt
// Obsidian Sync die Exporte weiterhin mit, ohne dass die App je von dort liest.
// Genau deshalb ist der Umgang mit fremden Dateien so vorsichtig — dort liegen
// womöglich handgepflegte Notizen.

import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { listAllRecipes } from "@/lib/repositories/recipes";
import {
  assignExportFileNames,
  isExportedFile,
  recipeToMarkdown,
} from "@/lib/services/recipeMarkdown";

export interface RecipeExportReport {
  /** Neu angelegt oder inhaltlich geändert. */
  written: number;
  /** Inhaltlich identisch — Datei nicht angefasst. */
  unchanged: number;
  /** Gelöschte Exportdateien, zu denen es kein Rezept mehr gibt. */
  removed: string[];
  /** `.md`-Dateien ohne unsere Signatur — bleiben unangetastet. */
  foreign: string[];
  errors: string[];
}

/**
 * Exportiert alle Rezepte nach `targetDir`. Der Ordner wird angelegt, falls er
 * fehlt.
 *
 * Geschrieben wird nur, was sich geändert hat: `recipeToMarkdown` ist
 * deterministisch, also bedeutet „gleicher Inhalt" auch „nichts zu tun". Das
 * hält die Änderungszeiten stabil und gibt Obsidian Sync nachts nichts zu tun,
 * solange niemand ein Rezept angefasst hat.
 *
 * Aufgeräumt werden nur Dateien, die unsere Signatur tragen (`exportedBy`).
 * Fremde `.md` werden gemeldet, nie gelöscht — der Exportordner kann der alte
 * Vault sein. `_`-Dateien (Obsidian-Vorlagen) bleiben ganz außen vor.
 */
export async function exportRecipes(
  targetDir: string,
  client: PrismaClient = prisma,
): Promise<RecipeExportReport> {
  const report: RecipeExportReport = {
    written: 0,
    unchanged: 0,
    removed: [],
    foreign: [],
    errors: [],
  };

  await mkdir(targetDir, { recursive: true });

  const recipes = await listAllRecipes(client);
  const fileNames = assignExportFileNames(recipes);
  const expected = new Set<string>();

  for (const recipe of recipes) {
    const file = fileNames.get(recipe.id)!;
    expected.add(file);
    const target = path.join(targetDir, file);
    const content = recipeToMarkdown(recipe);

    let existing: string | null = null;
    try {
      existing = await readFile(target, "utf8");
    } catch {
      existing = null; // gibt es noch nicht — gleich unten angelegt
    }

    if (existing === content) {
      report.unchanged += 1;
      continue;
    }

    try {
      await writeFile(target, content, "utf8");
      report.written += 1;
    } catch (error) {
      report.errors.push(`${file}: ${message(error)}`);
    }
  }

  await cleanup(targetDir, expected, report);

  return report;
}

/**
 * Räumt verwaiste Exportdateien weg — umbenannte oder endgültig gelöschte
 * Rezepte. Alles, was nicht nachweislich von uns stammt, wird nur gemeldet.
 */
async function cleanup(
  targetDir: string,
  expected: Set<string>,
  report: RecipeExportReport,
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(targetDir);
  } catch (error) {
    report.errors.push(`Exportordner nicht lesbar: ${message(error)}`);
    return;
  }

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(".md")) continue;
    if (entry.startsWith("_")) continue; // Obsidian-Vorlagen
    if (expected.has(entry)) continue;

    const full = path.join(targetDir, entry);
    let content: string;
    try {
      content = await readFile(full, "utf8");
    } catch {
      // Nicht lesbar heißt: wir wissen nicht, was drinsteht. Nicht löschen.
      report.foreign.push(entry);
      continue;
    }

    if (!isExportedFile(content)) {
      report.foreign.push(entry);
      continue;
    }

    try {
      await unlink(full);
      report.removed.push(entry);
    } catch (error) {
      report.errors.push(`${entry}: ${message(error)}`);
    }
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
