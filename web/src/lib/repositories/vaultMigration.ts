// EINMALIGE ÜBERNAHME: Obsidian-Vault → DB. Ab hier ist die DB die Wahrheit für
// Rezepte; der Vault wird nur noch als Backup-Ziel beschrieben, nie mehr gelesen.
//
// Unterschied zum früheren `ingestVault` (das dies hier ablöst):
//   - übernimmt ALLE Felder, auch Portionen, Zeiten, Nährwerte, Quelle, Schritte
//   - archiviert NICHTS. Ein Sync würde Rezepte ausmustern, die es nur in der
//     App gibt; das hier ist eine Übernahme, kein Abgleich.
//
// Dieses Modul ist Wegwerf-Code und fliegt mit dem Vault-Ausbau wieder raus.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { parseRecipeMarkdown, slugFromFilename } from "@/lib/services/recipeVault";

export interface VaultMigrationReport {
  created: number;
  updated: number;
  /** Rezepte ohne Zubereitungsschritte — die musst du in der App nachtragen. */
  withoutSteps: string[];
  errors: string[];
}

/**
 * Liest alle `*.md` in `vaultPath` (außer `_`-Vorlagen) und schreibt sie
 * vollständig in die DB. Upsert nach `slug`, damit der interne `Recipe.id`
 * — auf den `MealPlanEntry.recipeId` zeigt — erhalten bleibt.
 *
 * Mehrfach ausführbar. ACHTUNG: ein erneuter Lauf überschreibt Änderungen, die
 * inzwischen in der App gemacht wurden — der Vault gewinnt. Nach dem Cutover
 * also nicht mehr aufrufen.
 */
export async function migrateVaultToDb(
  vaultPath: string,
  client: PrismaClient = prisma,
): Promise<VaultMigrationReport> {
  const errors: string[] = [];
  const withoutSteps: string[] = [];
  let created = 0;
  let updated = 0;

  let files: string[];
  try {
    files = (await readdir(vaultPath)).filter(
      (f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"),
    );
  } catch {
    return { created: 0, updated: 0, withoutSteps: [], errors: [`Vault-Ordner nicht lesbar: ${vaultPath}`] };
  }

  for (const file of files) {
    let content: string;
    try {
      content = await readFile(path.join(vaultPath, file), "utf8");
    } catch {
      errors.push(`Datei nicht lesbar: ${file}`);
      continue;
    }

    const { recipe, errors: parseErrors } = parseRecipeMarkdown(content);
    for (const e of parseErrors) errors.push(`${file}: ${e}`);
    if (!recipe) continue;

    const slug = recipe.id ?? slugFromFilename(file);
    const fields = {
      name: recipe.name,
      rating: recipe.rating,
      simple: recipe.simple,
      reheatable: recipe.reheatable,
      tags: recipe.tags,
      archived: false,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      kcal: recipe.kcal,
      protein: recipe.protein,
      sourceUrl: recipe.sourceUrl,
      steps: recipe.steps.length > 0 ? JSON.stringify(recipe.steps) : null,
    };

    const existing = await client.recipe.findUnique({ where: { slug }, select: { id: true } });
    const saved = await client.recipe.upsert({
      where: { slug },
      create: { slug, ...fields },
      update: fields,
    });
    if (existing) updated += 1;
    else created += 1;

    if (recipe.steps.length === 0) withoutSteps.push(recipe.name);

    // Zutaten vollständig ersetzen — `sort` hält die Reihenfolge der Notiz fest.
    await client.ingredient.deleteMany({ where: { recipeId: saved.id } });
    for (const [index, ing] of recipe.ingredients.entries()) {
      await client.ingredient.create({
        data: {
          recipeId: saved.id,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          sort: index,
        },
      });
    }
  }

  return { created, updated, withoutSteps, errors };
}
