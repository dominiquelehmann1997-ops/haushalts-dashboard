# Rezepte-Vault V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rezepte werden in einem Obsidian-Vault (Markdown) gepflegt; das Dashboard liest den Vault ein und spiegelt ihn in die `Recipe`/`Ingredient`-DB-Tabellen (Vault = Wahrheit, DB = Cache).

**Architecture:** Eine reine Parse-Funktion (`parseRecipeMarkdown`, via `gray-matter`) wandelt eine `.md`-Datei in ein `ParsedRecipe`. Eine Repository-Funktion (`ingestVault`) liest den Vault-Ordner, upserted pro Rezept nach stabilem `slug`, ersetzt die Zutaten und archiviert verwaiste Rezepte. Eine Server-Action + ein Button lösen den Ingest manuell aus. `RECIPE_VAULT_PATH` zeigt auf die lokal per Obsidian Sync gesyncte Vault-Kopie.

**Tech Stack:** Next.js 16, Prisma 7 + better-sqlite3, Vitest 4, `gray-matter` (neu).

**Specs:** [2026-06-10-rezepte-vault-design.md](../specs/2026-06-10-rezepte-vault-design.md), [2026-06-10-sanftes-lernen-design.md](../specs/2026-06-10-sanftes-lernen-design.md)

**Scope:** Nur Vault-V1 (Schema + Ingest + Template + manueller Trigger). Feature A (Essensplan-Gewichtung) und C1 (Haltbarkeits-Korrektur) sind eigene Folgepläne (1b, 1c). Das `rating`-Feld wird hier angelegt (der Ingest befüllt es), aber erst von Plan 1b genutzt.

**Arbeitsverzeichnis:** Alle Befehle laufen in `web/` (sofern nicht anders angegeben). Pfade sind relativ zu `web/`, außer dem Plan/Template unter `docs/`.

---

### Task 1: `gray-matter`-Abhängigkeit hinzufügen

**Files:**
- Modify: `web/package.json` (dependencies)

- [ ] **Step 1: Paket installieren**

Run (in `web/`):
```bash
npm install gray-matter
```
Expected: `package.json` listet `gray-matter` unter `dependencies`; `package-lock.json` aktualisiert. `gray-matter` ab v4 bringt eigene TypeScript-Typen mit (kein separates `@types`-Paket nötig).

- [ ] **Step 2: Verifizieren, dass der Import auflöst**

Run:
```bash
node -e "const m=require('gray-matter'); console.log(typeof m)"
```
Expected: Ausgabe `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add gray-matter for recipe frontmatter parsing"
```

---

### Task 2: Schema-Felder `slug`, `archived`, `rating` am `Recipe`-Cache

**Files:**
- Modify: `web/prisma/schema.prisma` (model `Recipe`, ca. Z. 116-125)

`slug` ist **nullable** unique: Seed-/Bestandsrezepte ohne Vault-Herkunft tragen `null` (SQLite erlaubt mehrere NULLs in einer UNIQUE-Spalte), Vault-Rezepte tragen einen eindeutigen Slug. Der Ingest upserted nach `slug`.

- [ ] **Step 1: Felder ergänzen**

In `web/prisma/schema.prisma`, model `Recipe`, die drei Felder nach `tags` einfügen:

```prisma
model Recipe {
  id         String  @id @default(cuid())
  name       String
  simple     Boolean @default(true)
  reheatable Boolean @default(false)
  tags       String? // JSON string array
  rating     String  @default("ok") // "favorit" | "ok" | "selten" (aus Vault-Frontmatter; Feature A)
  slug       String? @unique // stabiler Vault-Anker (Frontmatter `id`); null für Nicht-Vault-Rezepte
  archived   Boolean @default(false) // true, wenn das Rezept nicht mehr im Vault liegt

  ingredients     Ingredient[]
  mealPlanEntries MealPlanEntry[]
}
```

- [ ] **Step 2: Migration erzeugen**

Run (in `web/`):
```bash
npx prisma migrate dev --name recipe_vault_fields
```
Expected: neuer Ordner unter `web/prisma/migrations/<timestamp>_recipe_vault_fields/` mit `migration.sql`, das `rating`, `slug`, `archived` zu `Recipe` hinzufügt. (Bei interaktiver Rückfrage zur dev-DB bestätigen.)

- [ ] **Step 3: Prisma-Client regenerieren**

`prisma migrate dev` regeneriert den Client hier NICHT zuverlässig (siehe Projekt-Doku) — explizit nachziehen:
```bash
node node_modules/prisma/build/index.js generate
```
Expected: „Generated Prisma Client …". `web/src/generated` ist gitignored.

- [ ] **Step 4: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: keine Fehler (das neue Feld ist optional/hat Defaults; bestehender Code bricht nicht).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add slug/archived/rating fields to Recipe cache"
```

---

### Task 3: Reine Parse-Funktionen `slugFromFilename` + `parseRecipeMarkdown`

**Files:**
- Create: `web/src/lib/services/recipeVault.ts`
- Test: `web/src/lib/services/recipeVault.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `web/src/lib/services/recipeVault.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseRecipeMarkdown, slugFromFilename } from "./recipeVault";

describe("slugFromFilename", () => {
  it("strips .md, lowercases, and dasherizes", () => {
    expect(slugFromFilename("Kokos-Curry mit Linsen.md")).toBe("kokos-curry-mit-linsen");
    expect(slugFromFilename("Pasta al Pomodoro.md")).toBe("pasta-al-pomodoro");
  });

  it("collapses runs of non-alphanumerics and trims dashes", () => {
    expect(slugFromFilename("  Reste!!  .md")).toBe("reste");
    expect(slugFromFilename("Gemüse-Curry.md")).toBe("gem-se-curry");
  });
});

describe("parseRecipeMarkdown", () => {
  const full = `---
id: kokos-curry-linsen
name: Kokos-Curry mit Linsen
rating: favorit
simple: true
reheatable: true
tags: [curry, vegan]
servings: 4
ingredients:
  - { name: rote Linsen, amount: 200, unit: g, freshness: haltbar }
  - { name: Spinat, amount: 100, unit: g, freshness: frisch }
  - { name: Salz }
---

## Zubereitung
1. Kochen.
`;

  it("parses a full recipe", () => {
    const { recipe, errors } = parseRecipeMarkdown(full);
    expect(errors).toEqual([]);
    expect(recipe).not.toBeNull();
    expect(recipe!.id).toBe("kokos-curry-linsen");
    expect(recipe!.name).toBe("Kokos-Curry mit Linsen");
    expect(recipe!.rating).toBe("favorit");
    expect(recipe!.simple).toBe(true);
    expect(recipe!.reheatable).toBe(true);
    expect(recipe!.tags).toBe('["curry","vegan"]');
  });

  it("coerces numeric amounts to strings and maps freshness to category", () => {
    const { recipe } = parseRecipeMarkdown(full);
    expect(recipe!.ingredients).toEqual([
      { name: "rote Linsen", amount: "200", unit: "g", category: "haltbar" },
      { name: "Spinat", amount: "100", unit: "g", category: "frisch" },
      { name: "Salz", amount: null, unit: null, category: null },
    ]);
  });

  it("defaults rating to 'ok' and simple to true when absent/invalid", () => {
    const md = `---\nname: Reste\nrating: lecker\n---\n`;
    const { recipe } = parseRecipeMarkdown(md);
    expect(recipe!.rating).toBe("ok");
    expect(recipe!.simple).toBe(true);
    expect(recipe!.reheatable).toBe(false);
    expect(recipe!.tags).toBeNull();
    expect(recipe!.ingredients).toEqual([]);
  });

  it("returns id null when frontmatter has no id (caller derives slug)", () => {
    const md = `---\nname: Reste\n---\n`;
    const { recipe } = parseRecipeMarkdown(md);
    expect(recipe!.id).toBeNull();
  });

  it("returns recipe null with an error when name is missing", () => {
    const { recipe, errors } = parseRecipeMarkdown(`---\nrating: ok\n---\n`);
    expect(recipe).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/name/i);
  });

  it("skips ingredient entries without a name but keeps the rest", () => {
    const md = `---\nname: X\ningredients:\n  - { amount: 1 }\n  - { name: Reis }\n---\n`;
    const { recipe, errors } = parseRecipeMarkdown(md);
    expect(recipe!.ingredients).toEqual([{ name: "Reis", amount: null, unit: null, category: null }]);
    expect(errors.some((e) => /ingredient/i.test(e))).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run:
```bash
npx vitest run src/lib/services/recipeVault.test.ts
```
Expected: FAIL — `Failed to resolve import "./recipeVault"` (Datei existiert noch nicht).

- [ ] **Step 3: Implementierung schreiben**

Create `web/src/lib/services/recipeVault.ts`:

```typescript
// Reine Vault-Parsing-Logik (kein DB/Next). Wandelt eine Rezept-Markdown-Datei
// (Frontmatter via gray-matter + Body) in ein `ParsedRecipe`. Die DB-Spiegelung
// übernimmt `recipeIngest.ts`.

import matter from "gray-matter";

import type { Freshness } from "@/lib/services/freshness";

export type Rating = "favorit" | "ok" | "selten";
const RATINGS: Rating[] = ["favorit", "ok", "selten"];

export interface ParsedIngredient {
  name: string;
  amount: string | null;
  unit: string | null;
  category: Freshness | null; // aus Frontmatter `freshness`; null → später Heuristik
}

export interface ParsedRecipe {
  id: string | null; // Frontmatter `id` (Slug); null → Caller leitet aus Dateinamen ab
  name: string;
  rating: Rating;
  simple: boolean;
  reheatable: boolean;
  tags: string | null; // JSON-String oder null
  ingredients: ParsedIngredient[];
}

export interface ParseResult {
  recipe: ParsedRecipe | null;
  errors: string[];
}

/** Dateiname → stabiler Fallback-Slug (lowercased, dasherized). */
export function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function parseIngredients(raw: unknown, errors: string[]): ParsedIngredient[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedIngredient[] = [];
  for (const entry of raw) {
    const name = entry && typeof entry === "object" ? (entry as Record<string, unknown>).name : undefined;
    if (typeof name !== "string" || name.trim() === "") {
      errors.push(`Zutat ohne Namen übersprungen: ${JSON.stringify(entry)}`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    const freshness = e.freshness;
    const category: Freshness | null =
      freshness === "frisch" || freshness === "haltbar" ? freshness : null;
    out.push({
      name: name.trim(),
      amount: toStringOrNull(e.amount),
      unit: toStringOrNull(e.unit),
      category,
    });
  }
  return out;
}

/**
 * Parst eine Rezept-Markdown-Datei. Pflichtfeld: `name`. Fehlt es, ist
 * `recipe` null und `errors` erklärt warum. `rating` fällt auf "ok" zurück,
 * `simple` auf true, `reheatable` auf false. `tags` (Array) wird zu JSON.
 */
export function parseRecipeMarkdown(content: string): ParseResult {
  const errors: string[] = [];
  const { data } = matter(content);

  const name = data.name;
  if (typeof name !== "string" || name.trim() === "") {
    errors.push("Pflichtfeld `name` fehlt oder ist leer.");
    return { recipe: null, errors };
  }

  const rating: Rating = RATINGS.includes(data.rating) ? data.rating : "ok";
  const simple = typeof data.simple === "boolean" ? data.simple : true;
  const reheatable = typeof data.reheatable === "boolean" ? data.reheatable : false;
  const tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : null;
  const id = typeof data.id === "string" && data.id.trim() !== "" ? data.id.trim() : null;

  const ingredients = parseIngredients(data.ingredients, errors);

  return {
    recipe: { id, name: name.trim(), rating, simple, reheatable, tags, ingredients },
    errors,
  };
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run:
```bash
npx vitest run src/lib/services/recipeVault.test.ts
```
Expected: PASS (alle 8 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/recipeVault.ts src/lib/services/recipeVault.test.ts
git commit -m "feat: parseRecipeMarkdown + slugFromFilename (pure vault parsing)"
```

---

### Task 4: Ingest-Repository `ingestVault`

**Files:**
- Create: `web/src/lib/repositories/recipeIngest.ts`
- Test: `web/src/lib/repositories/recipeIngest.test.ts`

`ingestVault` liest alle `*.md` (außer Dateien, die mit `_` beginnen → Template), parst sie, upserted nach `slug` (= Frontmatter-`id` oder Dateiname-Slug), ersetzt die Zutaten und archiviert Vault-Rezepte, die nicht mehr vorkommen. Nicht-Vault-Rezepte (`slug = null`, z.B. Seed) bleiben unberührt.

- [ ] **Step 1: Failing test schreiben**

Create `web/src/lib/repositories/recipeIngest.test.ts`:

```typescript
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { ingestVault } from "./recipeIngest";

function writeVault(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "vault-"));
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
ingredients:
  - { name: Kokosmilch, amount: 400, unit: ml, freshness: haltbar }
  - { name: Spinat, freshness: frisch }
---
## Zubereitung
1. Kochen.
`;

const SUPPE = `---
name: Möhrensuppe
---
`;

describe("ingestVault", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("upserts vault recipes by slug with ingredients and rating", async () => {
    const dir = writeVault({ "kokos-curry.md": CURRY, "Möhrensuppe.md": SUPPE, "_template.md": SUPPE });
    try {
      const report = await ingestVault(dir, client);
      expect(report.imported).toBe(2); // _template.md skipped
      expect(report.errors).toEqual([]);

      const curry = await client.recipe.findUnique({
        where: { slug: "kokos-curry" },
        include: { ingredients: true },
      });
      expect(curry?.name).toBe("Kokos-Curry");
      expect(curry?.rating).toBe("favorit");
      expect(curry?.reheatable).toBe(true);
      expect(curry?.archived).toBe(false);
      expect(curry?.ingredients.map((i) => [i.name, i.category]).sort()).toEqual([
        ["Kokosmilch", "haltbar"],
        ["Spinat", "frisch"],
      ]);

      // slug fallback from filename when frontmatter has no id
      const suppe = await client.recipe.findUnique({ where: { slug: "m-hrensuppe" } });
      expect(suppe?.name).toBe("Möhrensuppe");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("re-ingests idempotently and replaces ingredients", async () => {
    const dir = writeVault({ "kokos-curry.md": CURRY });
    try {
      await ingestVault(dir, client);
      const report = await ingestVault(dir, client); // second run
      expect(report.imported).toBe(1);
      const curry = await client.recipe.findUnique({
        where: { slug: "kokos-curry" },
        include: { ingredients: true },
      });
      expect(curry?.ingredients.length).toBe(2); // not duplicated
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("archives vault recipes that disappear from the vault, leaves seed recipes alone", async () => {
    const dir = writeVault({ "kokos-curry.md": CURRY, "Möhrensuppe.md": SUPPE });
    try {
      await ingestVault(dir, client);
      // Remove one file by re-pointing at a vault that no longer has it.
      const dir2 = writeVault({ "kokos-curry.md": CURRY });
      try {
        const report = await ingestVault(dir2, client);
        expect(report.archived).toBe(1);
        const suppe = await client.recipe.findUnique({ where: { slug: "m-hrensuppe" } });
        expect(suppe?.archived).toBe(true);
        // A seed recipe (slug null) is never archived.
        const seed = await client.recipe.findFirst({ where: { slug: null } });
        expect(seed?.archived).toBe(false);
      } finally {
        rmSync(dir2, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports an error and imports nothing for a missing vault path", async () => {
    const report = await ingestVault(path.join(tmpdir(), "does-not-exist-xyz"), client);
    expect(report.imported).toBe(0);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it("records a per-file error for a recipe without a name", async () => {
    const dir = writeVault({ "broken.md": `---\nrating: ok\n---\n` });
    try {
      const report = await ingestVault(dir, client);
      expect(report.imported).toBe(0);
      expect(report.errors.some((e) => /broken\.md/.test(e))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run:
```bash
npx vitest run src/lib/repositories/recipeIngest.test.ts
```
Expected: FAIL — `Failed to resolve import "./recipeIngest"`.

- [ ] **Step 3: Implementierung schreiben**

Create `web/src/lib/repositories/recipeIngest.ts`:

```typescript
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

  // Orphan-Archivierung: nur Vault-Rezepte (slug != null), die nicht gesehen wurden.
  const archivedResult = await client.recipe.updateMany({
    where: {
      slug: { notIn: seenSlugs },
      NOT: { slug: null },
      archived: false,
    },
    data: { archived: true },
  });

  return { imported, archived: archivedResult.count, errors };
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run:
```bash
npx vitest run src/lib/repositories/recipeIngest.test.ts
```
Expected: PASS (alle 5 Tests grün). Falls der erste Lauf wegen fehlender Migration scheitert (`no such column: slug`), zuerst `node node_modules/prisma/build/index.js generate` und sicherstellen, dass Task 2 committet ist — `globalSetup` baut die Test-DB aus den Migrationen.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/recipeIngest.ts src/lib/repositories/recipeIngest.test.ts
git commit -m "feat: ingestVault — mirror recipe vault into DB cache (upsert/archive)"
```

---

### Task 5: Server-Action `ingestVaultAction`

**Files:**
- Create: `web/src/app/actions/recipes.ts`

- [ ] **Step 1: Action schreiben**

Create `web/src/app/actions/recipes.ts`:

```typescript
"use server";

// Server-Action: liest den Rezepte-Vault (Pfad aus RECIPE_VAULT_PATH) ein und
// spiegelt ihn in die DB. Manuell ausgelöst über den VaultIngestControl-Button.

import { revalidatePath } from "next/cache";

import { ingestVault, type IngestReport } from "@/lib/repositories/recipeIngest";

export async function ingestVaultAction(): Promise<IngestReport> {
  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) {
    return { imported: 0, archived: 0, errors: ["RECIPE_VAULT_PATH ist nicht gesetzt."] };
  }
  const report = await ingestVault(vaultPath);
  revalidatePath("/");
  return report;
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/recipes.ts
git commit -m "feat: ingestVaultAction server action"
```

---

### Task 6: UI — `VaultIngestControl` + Einbau ins Dashboard

**Files:**
- Create: `web/src/components/VaultIngestControl.tsx`
- Modify: `web/src/components/dashboard.tsx` (Import + Einhängen)

- [ ] **Step 1: Komponente schreiben**

Create `web/src/components/VaultIngestControl.tsx` (Stil an `BringSyncControl` angelehnt):

```tsx
"use client";

// Manueller Trigger: liest den Rezepte-Vault ein und spiegelt ihn in die DB.
// Zeigt nach dem Lauf einen kurzen Report (importiert/archiviert/Fehler).

import { useState, useTransition } from "react";

import { ingestVaultAction } from "@/app/actions/recipes";
import type { IngestReport } from "@/lib/repositories/recipeIngest";

const PILL =
  "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function VaultIngestControl() {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<IngestReport | null>(null);

  const handleIngest = () => {
    startTransition(async () => {
      setReport(await ingestVaultAction());
    });
  };

  let label = "Rezepte einlesen";
  let tone = "text-ink-soft bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07]";
  if (pending) {
    label = "Lese …";
  } else if (report && report.errors.length === 0) {
    label = `✓ ${report.imported} eingelesen${report.archived > 0 ? `, ${report.archived} archiviert` : ""}`;
    tone = "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300";
  } else if (report && report.errors.length > 0) {
    label = `⚠ ${report.imported} ok, ${report.errors.length} Fehler`;
    tone = "text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300";
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleIngest}
        disabled={pending}
        className={`${PILL} ${tone} disabled:cursor-wait`}
      >
        {label}
      </button>
      {report && report.errors.length > 0 && (
        <ul className="text-right max-w-[260px] text-[11px] text-ink-faint dark:text-cream/50 space-y-0.5">
          {report.errors.slice(0, 3).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Import in `dashboard.tsx` ergänzen**

In `web/src/components/dashboard.tsx`, direkt nach der Zeile
```tsx
import { FreshShoppingControl } from "@/components/FreshShoppingControl";
```
einfügen:
```tsx
import { VaultIngestControl } from "@/components/VaultIngestControl";
```

- [ ] **Step 3: Button einhängen**

In `web/src/components/dashboard.tsx`, unmittelbar **vor** der Zeile
```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 items-start">
```
diesen Block einfügen (rechtsbündige kleine Aktion über der Kachel-Reihe):
```tsx
          <div className="flex justify-end mb-2">
            <VaultIngestControl />
          </div>
```

- [ ] **Step 4: Typecheck + Build-Smoke**

Run:
```bash
npm run typecheck
```
Expected: keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/components/VaultIngestControl.tsx src/components/dashboard.tsx
git commit -m "feat: VaultIngestControl button to trigger recipe-vault ingest"
```

---

### Task 7: Template + `RECIPE_VAULT_PATH` dokumentieren

**Files:**
- Create: `docs/recipe-vault-template.md` (kanonische Vorlage, die in den Vault kopiert wird)
- Modify: `web/README.md` (Env-Variable dokumentieren)

- [ ] **Step 1: Template-Datei anlegen**

Create `docs/recipe-vault-template.md`:

````markdown
# Rezept-Vorlage (`_template.md`)

Diese Datei als `_template.md` in den Obsidian-Rezepte-Vault legen und pro neuem
Rezept duplizieren. Dateien, die mit `_` beginnen, werden vom Ingest übersprungen.

Pflichtfeld: `name`. `id` ist empfohlen (stabiler Anker; fehlt sie, wird der
Dateiname als Slug genutzt). `rating` ∈ favorit | ok | selten (Default ok).
`freshness` pro Zutat ∈ frisch | haltbar (optional).

```markdown
---
id: mein-rezept-slug
name: Mein Rezept
rating: ok
simple: true
reheatable: false
tags: [schnell, vegetarisch]
servings: 4
prepMinutes: 15
cookMinutes: 25
nutrition:
  kcal: 540
  protein: 22
ingredients:
  - { name: Nudeln, amount: 500, unit: g, freshness: haltbar }
  - { name: Tomaten, amount: 6, unit: Stk, freshness: frisch }
---

## Zubereitung
1. …
2. …
```
````

- [ ] **Step 2: Env-Variable dokumentieren**

In `web/README.md` einen Abschnitt anhängen (am Dateiende):

```markdown

## Rezepte-Vault

Rezepte werden in einem Obsidian-Vault als Markdown gepflegt (Vault = Wahrheit,
DB = Cache). Das Dashboard liest die lokal per Obsidian Sync gesyncte Kopie.

Setze `RECIPE_VAULT_PATH` in `web/.env` auf den Rezepte-Ordner, z.B.:

```
RECIPE_VAULT_PATH="C:/Users/<user>/Obsidian/Haushalt/Rezepte"
```

Vorlage: `docs/recipe-vault-template.md` als `_template.md` in den Ordner kopieren.
Einlesen über den Button „Rezepte einlesen" im Dashboard.
```

- [ ] **Step 3: Commit**

```bash
git add ../docs/recipe-vault-template.md README.md
git commit -m "docs: recipe-vault template + RECIPE_VAULT_PATH setup"
```

> Hinweis: `docs/` liegt eine Ebene über `web/`; der `git add ../docs/...`-Pfad gilt, wenn das Terminal in `web/` steht. Alternativ vom Repo-Root committen.

---

### Task 8: Volle Test-Suite + Abschluss-Verifikation

- [ ] **Step 1: Komplette Suite laufen lassen**

Run (in `web/`):
```bash
npm test
```
Expected: alle Tests grün (die bestehenden 174 + die neuen aus Task 3 & 4). Falls ein bestehender Test wegen des neuen `Recipe`-Felds bricht, prüfen — es hat einen Default und ist nullable, sollte also nichts brechen.

- [ ] **Step 2: Typecheck + Lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: keine Fehler.

- [ ] **Step 3: Abschluss-Commit (falls noch uncommittete Reste)**

```bash
git status
```
Expected: working tree clean. Falls nicht, sinnvoll committen.

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung (Vault V1):** Schema-Spiegelung (`slug`/`archived`/`rating`) ✓ Task 2; `parseRecipeMarkdown`/`slugFromFilename` ✓ Task 3; Ingest mit Upsert/Zutaten-Replace/Orphan-Archiv + Template-Skip + Robustheit ✓ Task 4; `RECIPE_VAULT_PATH` + Action ✓ Task 5; manueller Trigger (Button) ✓ Task 6; `_template.md` ✓ Task 7. Frontmatter-`freshness` → `Ingredient.category` ✓ Task 3/4 (die Frische-Auflösungsreihenfolge insgesamt ist Plan 1c/C1). Stufe 1.5 (Claude-Skill) und Stufe 2 (In-App-Import) sind bewusst außerhalb von V1.

**Platzhalter:** keine — jeder Code-Step zeigt vollständigen Code, jeder Run zeigt erwartete Ausgabe.

**Typ-Konsistenz:** `IngestReport` (Task 4) wird in Task 5 (Action) und Task 6 (UI) identisch importiert/verwendet. `ParsedRecipe`/`ParsedIngredient`/`Rating`/`ParseResult` (Task 3) werden in Task 4 konsumiert. `Freshness` wird aus `@/lib/services/freshness` importiert (bestehender Export).

**Annahme zu prüfen bei Ausführung:** `gray-matter` Default-Import (`import matter from "gray-matter"`) funktioniert mit der TS/Next-Konfiguration (esModuleInterop). Falls nicht, `import * as matter` bzw. `matter.default` — in Task 3 Step 4 würde sich das zeigen.
