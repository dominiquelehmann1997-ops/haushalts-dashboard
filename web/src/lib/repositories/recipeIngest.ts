// Liest den Rezepte-Vault (Markdown) und spiegelt ihn in die `Recipe`/
// `Ingredient`-DB-Tabellen (Vault = Wahrheit, DB = Cache). Upsert nach `slug`,
// Zutaten werden ersetzt, verschwundene Vault-Rezepte werden archiviert.
// Nicht-Vault-Rezepte (slug = null, z.B. Seed) bleiben unberührt.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { parseRecipeMarkdown, slugFromFilename } from "@/lib/services/recipeVault";

export interface IngestReport {
  imported: number;
  archived: number;
  errors: string[];
}

/**
 * Liest alle `*.md` in `vaultPath` (außer Dateien, die mit `_` beginnen →
 * Template), upserted jedes Rezept nach `slug` und ersetzt seine Zutaten.
 * Vault-Rezepte, deren `slug` nicht mehr vorkommt, werden `archived=true`.
 * Ein fehlender/nicht lesbarer Ordner ergibt einen Fehler-Report (imported 0).
 */
export async function ingestVault(
  vaultPath: string,
  client: PrismaClient = prisma,
): Promise<IngestReport> {
  const errors: string[] = [];

  let files: string[];
  try {
    files = (await readdir(vaultPath)).filter(
      (f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"),
    );
  } catch {
    return { imported: 0, archived: 0, errors: [`Vault-Ordner nicht lesbar: ${vaultPath}`] };
  }

  const seenSlugs: string[] = [];
  let imported = 0;

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
    seenSlugs.push(slug);

    const saved = await client.recipe.upsert({
      where: { slug },
      create: {
        slug,
        name: recipe.name,
        rating: recipe.rating,
        simple: recipe.simple,
        reheatable: recipe.reheatable,
        tags: recipe.tags,
        archived: false,
      },
      update: {
        name: recipe.name,
        rating: recipe.rating,
        simple: recipe.simple,
        reheatable: recipe.reheatable,
        tags: recipe.tags,
        archived: false,
      },
    });

    await client.ingredient.deleteMany({ where: { recipeId: saved.id } });
    for (const ing of recipe.ingredients) {
      await client.ingredient.create({
        data: {
          recipeId: saved.id,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          category: ing.category,
        },
      });
    }
    imported += 1;
  }

  // Orphan-Archivierung: nur wenn überhaupt Rezepte gesehen wurden (sonst würde
  // ein leerer/transient leerer Vault fälschlich ALLE Vault-Rezepte archivieren).
  // Nur Vault-Rezepte (slug != null), die nicht gesehen wurden.
  let archived = 0;
  if (seenSlugs.length > 0) {
    const archivedResult = await client.recipe.updateMany({
      where: {
        slug: { notIn: seenSlugs },
        NOT: { slug: null },
        archived: false,
      },
      data: { archived: true },
    });
    archived = archivedResult.count;
  }

  return { imported, archived, errors };
}

/**
 * Spiegelt den Vault aus `RECIPE_VAULT_PATH` in die DB — aber nur, wenn die
 * Variable gesetzt ist. Gibt `null` zurück, wenn kein Vault konfiguriert ist
 * (No-op). Gedacht als Auto-Sync vor der Entwurfs-Erzeugung, damit neue
 * Obsidian-Rezepte ohne manuellen "Rezepte einlesen"-Klick verfügbar sind.
 * Wirft nicht (ingestVault fängt fehlende/unlesbare Ordner selbst ab).
 */
export async function ingestVaultIfConfigured(
  client: PrismaClient = prisma,
): Promise<IngestReport | null> {
  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) return null;
  return ingestVault(vaultPath, client);
}
