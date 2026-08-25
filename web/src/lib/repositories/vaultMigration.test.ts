import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { migrateVaultToDb } from "./vaultMigration";

const dirs: string[] = [];

function writeVault(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "vault-mig-"));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const CURRY = `---
id: kokos-curry
name: Kokos-Curry
rating: favorit
simple: false
reheatable: true
source: https://www.chefkoch.de/rezepte/1
tags: [curry, vegan]
servings: 4
prepMinutes: 15
cookMinutes: 25
nutrition:
  kcal: 540
  protein: 22
ingredients:
  - { name: Kokosmilch, amount: 400, unit: ml }
  - { name: Spinat }
---

## Zubereitung
1. Zwiebeln anschwitzen.
2. Kokosmilch zugeben.
`;

const MINIMAL = `---
name: Möhrensuppe
---
`;

describe("migrateVaultToDb", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("übernimmt alle Felder, die der frühere Ingest verworfen hat", async () => {
    const dir = writeVault({ "Kokos-Curry.md": CURRY });
    const report = await migrateVaultToDb(dir, client);

    expect(report.created).toBe(1);
    expect(report.errors).toEqual([]);

    const saved = await client.recipe.findUniqueOrThrow({
      where: { slug: "kokos-curry" },
      include: { ingredients: { orderBy: { sort: "asc" } } },
    });
    expect(saved).toMatchObject({
      name: "Kokos-Curry",
      rating: "favorit",
      simple: false,
      reheatable: true,
      tags: '["curry","vegan"]',
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 25,
      kcal: 540,
      protein: 22,
      sourceUrl: "https://www.chefkoch.de/rezepte/1",
      archived: false,
    });
    expect(JSON.parse(saved.steps!)).toEqual([
      "Zwiebeln anschwitzen.",
      "Kokosmilch zugeben.",
    ]);
    expect(saved.ingredients.map((i) => [i.name, i.amount, i.unit, i.sort])).toEqual([
      ["Kokosmilch", "400", "ml", 0],
      ["Spinat", null, null, 1],
    ]);
  });

  it("leitet den Slug aus dem Dateinamen ab, wenn das Frontmatter keine id hat", async () => {
    const dir = writeVault({ "Möhrensuppe.md": MINIMAL });
    await migrateVaultToDb(dir, client);
    const saved = await client.recipe.findFirst({ where: { name: "Möhrensuppe" } });
    expect(saved!.slug).toBe("m-hrensuppe");
    expect(saved!.steps).toBeNull();
  });

  it("meldet Rezepte ohne Zubereitung, damit sie nachgetragen werden können", async () => {
    const dir = writeVault({ "Kokos-Curry.md": CURRY, "Suppe.md": MINIMAL });
    const report = await migrateVaultToDb(dir, client);
    expect(report.withoutSteps).toEqual(["Möhrensuppe"]);
  });

  it("ist idempotent und behält die interne id (MealPlanEntry-Verweise bleiben heil)", async () => {
    const dir = writeVault({ "Kokos-Curry.md": CURRY });
    await migrateVaultToDb(dir, client);
    const first = await client.recipe.findUniqueOrThrow({ where: { slug: "kokos-curry" } });

    const second = await migrateVaultToDb(dir, client);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);

    const after = await client.recipe.findUniqueOrThrow({
      where: { slug: "kokos-curry" },
      include: { ingredients: true },
    });
    expect(after.id).toBe(first.id);
    expect(after.ingredients).toHaveLength(2); // keine Dubletten
  });

  it("archiviert nichts — App-eigene Rezepte überleben die Übernahme", async () => {
    // Rezept, das es nur in der App gibt (kein slug, nicht im Vault).
    const eigen = await client.recipe.create({ data: { name: "Nur in der App" } });
    const dir = writeVault({ "Kokos-Curry.md": CURRY });

    await migrateVaultToDb(dir, client);

    const after = await client.recipe.findUniqueOrThrow({ where: { id: eigen.id } });
    expect(after.archived).toBe(false);
  });

  it("überspringt Vorlagen und kaputte Dateien, ohne abzubrechen", async () => {
    const dir = writeVault({
      "_template.md": "---\nname: Vorlage\n---\n",
      "kaputt.md": "---\nrating: ok\n---\n",
      "Kokos-Curry.md": CURRY,
    });

    const report = await migrateVaultToDb(dir, client);

    expect(report.created).toBe(1);
    expect(report.errors.some((e) => /kaputt\.md/.test(e))).toBe(true);
    expect(await client.recipe.findFirst({ where: { name: "Vorlage" } })).toBeNull();
  });

  it("gibt einen Fehler-Report statt zu werfen, wenn der Ordner fehlt", async () => {
    const report = await migrateVaultToDb(path.join(tmpdir(), "gibt-es-nicht-xyz"), client);
    expect(report.created).toBe(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatch(/nicht lesbar/);
  });
});
