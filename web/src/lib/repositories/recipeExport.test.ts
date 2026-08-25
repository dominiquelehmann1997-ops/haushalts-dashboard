import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { EXPORT_MARKER } from "@/lib/services/recipeMarkdown";

import { exportRecipes } from "./recipeExport";

// Die Seed-Fixtures liefern fünf Rezepte (siehe prisma/seed.ts).
const SEEDED = 5;

const dirs: string[] = [];

function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "recipe-export-"));
  dirs.push(dir);
  return dir;
}

function mdFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

describe("exportRecipes", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("schreibt jedes Rezept als eigene Datei", async () => {
    const dir = makeDir();
    const report = await exportRecipes(dir, client);

    expect(report.written).toBe(SEEDED);
    expect(report.errors).toEqual([]);
    expect(mdFiles(dir)).toContain("gemuese-curry.md");

    const { data, content } = matter(readFileSync(path.join(dir, "gemuese-curry.md"), "utf8"));
    expect(data.name).toBe("Gemüse-Curry");
    expect(data.exportedBy).toBe(EXPORT_MARKER);
    expect(data.ingredients.length).toBeGreaterThan(0);
    expect(content).toContain("## Zubereitung");
  });

  it("legt den Zielordner an, wenn es ihn noch nicht gibt", async () => {
    const dir = path.join(makeDir(), "backup", "rezepte");
    const report = await exportRecipes(dir, client);

    expect(report.written).toBe(SEEDED);
    expect(mdFiles(dir).length).toBe(SEEDED);
  });

  it("lässt unveränderte Dateien in Ruhe", async () => {
    // Sonst überträgt Obsidian Sync jede Nacht den ganzen Ordner neu.
    const dir = makeDir();
    await exportRecipes(dir, client);
    const report = await exportRecipes(dir, client);

    expect(report.written).toBe(0);
    expect(report.unchanged).toBe(SEEDED);
    expect(report.removed).toEqual([]);
  });

  it("schreibt nur das Rezept neu, das sich geändert hat", async () => {
    const dir = makeDir();
    await exportRecipes(dir, client);

    await client.recipe.update({
      where: { id: (await client.recipe.findFirstOrThrow({ where: { name: "Reste" } })).id },
      data: { notes: "Immer freitags." },
    });
    const report = await exportRecipes(dir, client);

    expect(report.written).toBe(1);
    expect(report.unchanged).toBe(SEEDED - 1);
    expect(readFileSync(path.join(dir, "reste.md"), "utf8")).toContain("Immer freitags.");
  });

  it("räumt die Datei eines gelöschten Rezepts weg", async () => {
    const dir = makeDir();
    await exportRecipes(dir, client);

    const reste = await client.recipe.findFirstOrThrow({ where: { name: "Reste" } });
    await client.mealPlanEntry.deleteMany({ where: { recipeId: reste.id } });
    await client.ingredient.deleteMany({ where: { recipeId: reste.id } });
    await client.recipe.delete({ where: { id: reste.id } });

    const report = await exportRecipes(dir, client);

    expect(report.removed).toEqual(["reste.md"]);
    expect(existsSync(path.join(dir, "reste.md"))).toBe(false);
  });

  it("räumt die alte Datei weg, wenn ein Rezept umbenannt wird", async () => {
    const dir = makeDir();
    await exportRecipes(dir, client);

    const reste = await client.recipe.findFirstOrThrow({ where: { name: "Reste" } });
    await client.recipe.update({ where: { id: reste.id }, data: { name: "Restetag" } });

    const report = await exportRecipes(dir, client);

    expect(report.removed).toEqual(["reste.md"]);
    expect(existsSync(path.join(dir, "restetag.md"))).toBe(true);
  });

  it("fasst fremde Notizen nicht an und meldet sie", async () => {
    // RECIPE_EXPORT_PATH darf der alte Vault sein — dort liegen handgepflegte
    // Notizen, die niemand löschen darf.
    const dir = makeDir();
    writeFileSync(path.join(dir, "omas-auflauf.md"), "---\nname: Omas Auflauf\n---\n\nVon Hand.\n");
    writeFileSync(path.join(dir, "einkaufsliste.md"), "Kein Frontmatter.\n");

    const report = await exportRecipes(dir, client);

    expect(report.foreign.sort()).toEqual(["einkaufsliste.md", "omas-auflauf.md"]);
    expect(report.removed).toEqual([]);
    expect(readFileSync(path.join(dir, "einkaufsliste.md"), "utf8")).toBe("Kein Frontmatter.\n");
  });

  it("überschreibt eine fremde Notiz, die zufällig heißt wie ein Rezept", async () => {
    // Der Export ist die Wahrheit für seine eigenen Dateinamen. Gemeldet wird
    // die Datei nicht — sie ist kein verwaister Rest, sondern eine Kollision.
    const dir = makeDir();
    writeFileSync(path.join(dir, "reste.md"), "Handnotiz.\n");

    const report = await exportRecipes(dir, client);

    expect(report.written).toBe(SEEDED);
    expect(report.foreign).toEqual([]);
    expect(readFileSync(path.join(dir, "reste.md"), "utf8")).toContain(`exportedBy: ${EXPORT_MARKER}`);
  });

  it("lässt Obsidian-Vorlagen (`_`) links liegen", async () => {
    const dir = makeDir();
    writeFileSync(path.join(dir, "_template.md"), "---\nname: Vorlage\n---\n");

    const report = await exportRecipes(dir, client);

    expect(report.foreign).toEqual([]);
    expect(existsSync(path.join(dir, "_template.md"))).toBe(true);
  });

  it("nimmt archivierte Rezepte mit und markiert sie", async () => {
    const dir = makeDir();
    const reste = await client.recipe.findFirstOrThrow({ where: { name: "Reste" } });
    await client.recipe.update({ where: { id: reste.id }, data: { archived: true } });

    const report = await exportRecipes(dir, client);

    expect(report.written).toBe(SEEDED);
    expect(matter(readFileSync(path.join(dir, "reste.md"), "utf8")).data.archived).toBe(true);
  });
});
