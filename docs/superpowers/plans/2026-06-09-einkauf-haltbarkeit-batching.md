# Einkauf nach Haltbarkeit, gestaffelt auf Bring (Roadmap D1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zutaten eines abgenickten Plans gehen nicht mehr in einer Rutsche auf Bring, sondern nach Haltbarkeit: **haltbar** sofort beim Abnicken, **frisch** später per Knopf (nah am Verbrauch).

**Architecture:** `category` ("frisch"|"haltbar") an `Ingredient` (per Namens-Heuristik vorbelegt) und an `ShoppingItem` (+ `pushed`-Flag). Reine `classifyFreshness`/`suggestFreshShoppingDay`; `pushRecipeBatch(category)` pusht+markiert eine Rutsche; `getFreshShoppingState` treibt einen `FreshShoppingControl`. Der C1-Platzhalter `planShoppingBatches` wird entfernt.

**Tech Stack:** TypeScript, Next.js (App Router, Server Actions), Prisma + SQLite (better-sqlite3), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-einkauf-haltbarkeit-batching-design.md`

**Working directory for all commands:** `web/` (Pfade relativ zu `web/`). Git-Commits vom Repo-Root `c:\Users\ThinkPad\Documents\Claude\Dashboard` (Pfade `web/...`).

---

## File Structure

- **Modify** `prisma/schema.prisma` — `Ingredient.category`, `ShoppingItem.category`/`pushed`.
- **Create** `src/lib/services/freshness.ts` — reine `classifyFreshness` + `suggestFreshShoppingDay`.
- **Create** `src/lib/services/freshness.test.ts`.
- **Modify** `prisma/seed.ts` — Zutaten-Kategorien per `classifyFreshness`.
- **Modify** `src/lib/services/shoppingSync.ts` — Rezept-Items mit `category`+`pushed` taggen.
- **Modify** `src/lib/services/shoppingSync.test.ts` — Tag-Test.
- **Create** `src/lib/services/shoppingBatch.ts` — `pushRecipeBatch(category)`.
- **Create** `src/lib/services/shoppingBatch.test.ts`.
- **Modify** `src/lib/data.ts` — `FreshShoppingState` DTO.
- **Modify** `src/lib/repositories/shopping.ts` — `getFreshShoppingState`.
- **Modify** `src/lib/repositories/shopping.test.ts` — Test (Datei ggf. neu am Muster).
- **Modify** `src/app/actions/meals.ts` — approve pusht nur haltbar; `pushFreshBatchAction`.
- **Delete** `src/lib/services/shoppingBatches.ts` + `src/lib/services/shoppingBatches.test.ts`.
- **Create** `src/components/FreshShoppingControl.tsx`.
- **Modify** `src/components/dashboard.tsx`, `src/app/page.tsx` — Frische-Status laden/rendern.

---

## Task 1: Schema — Kategorien + pushed

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Edit schema** — `Ingredient` und `ShoppingItem` erweitern:

```prisma
model Ingredient {
  id String @id @default(cuid())

  recipeId String
  recipe   Recipe @relation(fields: [recipeId], references: [id])

  name     String
  amount   String?
  unit     String?
  category String? // "frisch" | "haltbar" (per classifyFreshness vorbelegt)
}
```

```prisma
model ShoppingItem {
  id        String   @id @default(cuid())
  text      String
  meal      Boolean  @default(false)
  source    String   @default("manual") // "manual" | "recipe"
  recipeRef String?
  category  String? // "frisch" | "haltbar" für Rezept-Items; null für manuelle
  pushed    Boolean  @default(false) // schon auf Bring? (nur Rezept-Items)
  done      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Migration + Client neu generieren**

Run: `node node_modules/prisma/build/index.js migrate dev --name shopping_freshness`
Then: `node node_modules/prisma/build/index.js generate`
Expected: Migration `*_shopping_freshness` angelegt/angewandt; „Generated Prisma Client".

- [ ] **Step 3: Full suite (Test-DB nimmt Migration über globalSetup auf)**

Run: `npm test`
Expected: PASS (additive Felder, Default/Nullable — nichts bricht).

- [ ] **Step 4: Commit**

```bash
git add web/prisma/schema.prisma web/prisma/migrations
git commit -m "feat: Ingredient.category + ShoppingItem.category/pushed (Haltbarkeit)"
```

---

## Task 2: Reine `classifyFreshness` + `suggestFreshShoppingDay`

**Files:** Create `src/lib/services/freshness.ts`, Test `src/lib/services/freshness.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/services/freshness.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { classifyFreshness, suggestFreshShoppingDay } from "./freshness";

describe("classifyFreshness", () => {
  it("classifies known fresh keywords as frisch (case-insensitive, substring)", () => {
    expect(classifyFreshness("Salat")).toBe("frisch");
    expect(classifyFreshness("Milch")).toBe("frisch");
    expect(classifyFreshness("Hackfleisch")).toBe("frisch"); // substring "hack"/"fleisch"
    expect(classifyFreshness("Basilikum")).toBe("frisch");
    expect(classifyFreshness("tomaten")).toBe("frisch");
    expect(classifyFreshness("Zucchini")).toBe("frisch");
  });

  it("defaults to haltbar for everything else", () => {
    expect(classifyFreshness("Nudeln")).toBe("haltbar");
    expect(classifyFreshness("Reis")).toBe("haltbar");
    expect(classifyFreshness("Mehl")).toBe("haltbar");
    expect(classifyFreshness("Olivenöl")).toBe("haltbar");
    expect(classifyFreshness("")).toBe("haltbar");
  });
});

describe("suggestFreshShoppingDay", () => {
  it("returns the day before the earliest fresh-use date", () => {
    const thu = new Date(2026, 5, 11); // Thu 2026-06-11
    expect(suggestFreshShoppingDay(thu)).toEqual(new Date(2026, 5, 10)); // Wed
  });

  it("rolls over a month boundary", () => {
    const first = new Date(2026, 6, 1); // 2026-07-01
    expect(suggestFreshShoppingDay(first)).toEqual(new Date(2026, 5, 30)); // 2026-06-30
  });

  it("returns null when there is no fresh-use date", () => {
    expect(suggestFreshShoppingDay(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/lib/services/freshness.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/services/freshness.ts`:

```ts
// Reine Haltbarkeits-Heuristik für Zutaten + Vorschlagstag für den Frische-
// Einkauf. Kein DB/Next. Die Heuristik ist bewusst grob (überschreibbar über
// `Ingredient.category`); sie liefert nur einen sinnvollen Default.

import { addDays } from "@/lib/dates";

export type Freshness = "frisch" | "haltbar";

/** Namens-Schlüsselwörter (lowercased), die auf eine frische Zutat hindeuten. */
const FRESH_KEYWORDS = [
  "salat",
  "milch",
  "joghurt",
  "sahne",
  "quark",
  "fleisch",
  "hack",
  "hähnchen",
  "fisch",
  "lachs",
  "kräuter",
  "basilikum",
  "petersilie",
  "schnittlauch",
  "tomate",
  "gurke",
  "zucchini",
  "paprika",
  "karotte",
  "möhre",
  "banane",
  "apfel",
  "beeren",
  "ei",
] as const;

/**
 * Grobe Haltbarkeits-Kategorie aus dem Zutaten-Namen: enthält der (lowercased)
 * Name eines der Frisch-Schlüsselwörter → "frisch", sonst → "haltbar" (Default).
 */
export function classifyFreshness(name: string): Freshness {
  const n = name.trim().toLowerCase();
  return FRESH_KEYWORDS.some((kw) => n.includes(kw)) ? "frisch" : "haltbar";
}

/**
 * Vorschlagstag für die Frische-Rutsche: der Tag VOR dem frühesten Verbrauchstag
 * einer Frisch-Zutat (etwas Vorlauf). `null`, wenn es keinen Frisch-Verbrauch gibt.
 */
export function suggestFreshShoppingDay(earliestFreshUse: Date | null): Date | null {
  return earliestFreshUse ? addDays(earliestFreshUse, -1) : null;
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/lib/services/freshness.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/freshness.ts web/src/lib/services/freshness.test.ts
git commit -m "feat: classifyFreshness + suggestFreshShoppingDay (rein)"
```

---

## Task 3: Seed setzt Zutaten-Kategorien

**Files:** Modify `prisma/seed.ts`

- [ ] **Step 1: Implement** — in `prisma/seed.ts` den `classifyFreshness`-Import oben ergänzen (zu den anderen Importen):

```ts
import { classifyFreshness } from "../src/lib/services/freshness";
```

Im Ingredient-Erzeugungs-Loop das `data`-Objekt um `category` ergänzen. Aktuell:
```ts
      await prisma.ingredient.create({
        data: {
          recipeId: recipe.id,
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
        },
```
ersetzen durch:
```ts
      await prisma.ingredient.create({
        data: {
          recipeId: recipe.id,
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          category: classifyFreshness(ingredient.name),
        },
```

- [ ] **Step 2: Re-seed + verify**

Run: `npx tsx prisma/seed.ts`
Expected: „Seed completed."

Run: `node -e "const D=require('better-sqlite3');const db=new D('dev.db');console.log(db.prepare('SELECT name,category FROM Ingredient ORDER BY name').all())"`
Expected: z. B. `Tomaten`/`Basilikum`/`Karotten`/`Zucchini` = `frisch`; `Nudeln`/`Reis`/`Olivenöl`/`Pizzateig` = `haltbar`.

- [ ] **Step 3: Full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/prisma/seed.ts
git commit -m "feat: Seed-Zutaten mit Haltbarkeits-Kategorie"
```

---

## Task 4: `syncIngredientsToShopping` taggt Kategorie + pushed

**Files:** Modify `src/lib/services/shoppingSync.ts`, `src/lib/services/shoppingSync.test.ts`

- [ ] **Step 1: Write the failing test** — in `src/lib/services/shoppingSync.test.ts` einen Test im `describe("shoppingSync service", ...)` anfügen:

```ts
  it("tags recipe shopping items with a freshness category and pushed=false", async () => {
    await syncIngredientsToShopping(client);

    const tomaten = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Tomaten" },
    });
    expect(tomaten.category).toBe("frisch");
    expect(tomaten.pushed).toBe(false);

    const nudeln = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Nudeln" },
    });
    expect(nudeln.category).toBe("haltbar");
  });
```
(Die seed-aktive Mo-Mahlzeit „Pasta al Pomodoro" liefert Tomaten=frisch und Nudeln=haltbar.)

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/lib/services/shoppingSync.test.ts`
Expected: FAIL — `category`/`pushed` noch nicht gesetzt.

- [ ] **Step 3: Implement** — in `src/lib/services/shoppingSync.ts`.

Import ergänzen:
```ts
import { classifyFreshness } from "@/lib/services/freshness";
```

Die Aggregation muss neben dem Namen auch die Kategorie behalten. Ersetze den
Map-Aufbau und das (Re-)Create so:

```ts
  // Case-insensitive dedupe, preserving first-seen casing for display and the
  // ingredient's freshness category (falls back to the name heuristic).
  const byKey = new Map<string, { name: string; category: string }>();
  for (const entry of entries) {
    for (const ingredient of entry.recipe.ingredients) {
      const key = ingredient.name.trim().toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, {
          name: ingredient.name.trim(),
          category: ingredient.category ?? classifyFreshness(ingredient.name),
        });
      }
    }
  }

  await client.shoppingItem.deleteMany({ where: { source: "recipe" } });

  const entriesOut = [...byKey.values()];
  for (const item of entriesOut) {
    await client.shoppingItem.create({
      data: {
        text: item.name,
        meal: true,
        source: "recipe",
        category: item.category,
        pushed: false,
        done: false,
      },
    });
  }

  return entriesOut.map((e) => e.name);
```

(Hinweis: der bestehende active-Filter `status:"active"` in der `findMany`-Query
bleibt unverändert; nur der Map-Wert und der `create`-Aufruf ändern sich. Der
Rückgabewert bleibt `string[]` der Namen.)

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/lib/services/shoppingSync.test.ts`
Expected: PASS (neuer + bestehende Tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/shoppingSync.ts web/src/lib/services/shoppingSync.test.ts
git commit -m "feat: syncIngredientsToShopping taggt Kategorie + pushed"
```

---

## Task 5: `pushRecipeBatch(category)`

**Files:** Create `src/lib/services/shoppingBatch.ts`, Test `src/lib/services/shoppingBatch.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/services/shoppingBatch.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { BringItem, BringPushResult } from "@/integrations/bring/client";

import { syncIngredientsToShopping } from "./shoppingSync";
import { pushRecipeBatch } from "./shoppingBatch";

describe("pushRecipeBatch", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
    await syncIngredientsToShopping(client); // recipe items with categories
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  /** Records what was pushed; reports success. */
  function fakePush() {
    const calls: BringItem[][] = [];
    const push = async (items: BringItem[]): Promise<BringPushResult> => {
      calls.push(items);
      return { ok: true, pushed: items.length };
    };
    return { calls, push };
  }

  it("pushes only the given category's recipe items and marks them pushed", async () => {
    const { calls, push } = fakePush();
    const res = await pushRecipeBatch("haltbar", client, push);

    expect(res.bring.ok).toBe(true);
    expect(calls).toHaveLength(1);
    // every pushed name belongs to a haltbar recipe item
    const haltbar = await client.shoppingItem.findMany({
      where: { source: "recipe", category: "haltbar" },
    });
    expect(haltbar.every((i) => i.pushed)).toBe(true);
    // frisch items are untouched
    const frisch = await client.shoppingItem.findMany({
      where: { source: "recipe", category: "frisch" },
    });
    expect(frisch.every((i) => !i.pushed)).toBe(true);
  });

  it("does not mark items pushed when the push fails", async () => {
    const failingPush = async (): Promise<BringPushResult> => ({ ok: false, error: "boom" });
    const res = await pushRecipeBatch("haltbar", client, failingPush);

    expect(res.bring.ok).toBe(false);
    const haltbar = await client.shoppingItem.findMany({
      where: { source: "recipe", category: "haltbar" },
    });
    expect(haltbar.every((i) => !i.pushed)).toBe(true);
  });

  it("a second push of the same category pushes nothing (all already pushed)", async () => {
    const { push } = fakePush();
    await pushRecipeBatch("haltbar", client, push);
    const second = await pushRecipeBatch("haltbar", client, push);
    expect(second.items).toEqual([]);
    expect(second.bring).toEqual({ ok: true, pushed: 0 });
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/lib/services/shoppingBatch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/services/shoppingBatch.ts`:

```ts
// Pusht eine Einkaufs-Rutsche (eine Haltbarkeits-Kategorie der Rezept-Items) auf
// Bring und markiert sie als gepusht. Roadmap D1: "haltbar" beim Abnicken,
// "frisch" später per Knopf. Der Push selbst ist injizierbar (Default
// `pushShoppingList`), damit die Auswahl-/Markier-Logik ohne Netz testbar ist.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import {
  pushShoppingList,
  type BringItem,
  type BringPushResult,
} from "@/integrations/bring/client";

/**
 * Pusht die noch nicht gepushten, offenen Rezept-Items der Kategorie `category`
 * (`source:"recipe"`, `pushed:false`, `done:false`) auf Bring und setzt bei
 * Erfolg `pushed=true`. Liefert das Bring-Ergebnis und die betroffenen Namen
 * (für den Kopier-Fallback). Leere Auswahl → no-op-Erfolg.
 */
export async function pushRecipeBatch(
  category: "frisch" | "haltbar",
  client: PrismaClient = prisma,
  push: (items: BringItem[]) => Promise<BringPushResult> = pushShoppingList,
): Promise<{ bring: BringPushResult; items: string[] }> {
  const rows = await client.shoppingItem.findMany({
    where: { source: "recipe", category, pushed: false, done: false },
    orderBy: { createdAt: "asc" },
  });
  const items = rows.map((r) => r.text);
  if (items.length === 0) return { bring: { ok: true, pushed: 0 }, items: [] };

  const bring = await push(rows.map((r) => ({ name: r.text })));
  if (bring.ok) {
    await client.shoppingItem.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { pushed: true },
    });
  }
  return { bring, items };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/lib/services/shoppingBatch.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/shoppingBatch.ts web/src/lib/services/shoppingBatch.test.ts
git commit -m "feat: pushRecipeBatch (eine Haltbarkeits-Rutsche pushen + markieren)"
```

---

## Task 6: `getFreshShoppingState` + DTO

**Files:** Modify `src/lib/data.ts`, `src/lib/domain.ts`, `src/lib/repositories/shopping.ts`, `src/lib/repositories/shopping.test.ts`

- [ ] **Step 1: DTO** — in `src/lib/data.ts` nach dem `ShoppingItem`-Interface anfügen:

```ts
export interface FreshShoppingState {
  /** Offene Frisch-Rezept-Items, die noch nicht auf Bring sind. */
  pendingItems: string[];
  /** Vorschlagstag (ISO) für den Frische-Einkauf, oder null. */
  suggestedDayISO: string | null;
}
```
In `src/lib/domain.ts` `FreshShoppingState` zur `export type { ... } from "./data";`-Liste hinzufügen.

- [ ] **Step 2: Write the failing test** — `src/lib/repositories/shopping.test.ts`.

READ die Datei zuerst (falls sie existiert, am bestehenden Muster anhängen; sonst nach dem Muster von `meals.test.ts` neu anlegen). Test:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";
import { syncIngredientsToShopping } from "@/lib/services/shoppingSync";

import { getFreshShoppingState } from "./shopping";

describe("getFreshShoppingState", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
    await syncIngredientsToShopping(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("returns the open fresh recipe items and a suggested day before earliest fresh use", async () => {
    const state = await getFreshShoppingState(client);

    // Seed Monday = Pasta al Pomodoro (Tomaten/Basilikum = frisch).
    expect(state.pendingItems).toContain("Tomaten");
    expect(state.pendingItems).not.toContain("Nudeln"); // haltbar

    // Earliest fresh use is Monday → suggested day is Sunday (day before).
    const { start } = currentWeekBounds();
    const sunday = new Date(start);
    sunday.setDate(sunday.getDate() - 1);
    expect(state.suggestedDayISO).toBe(sunday.toISOString());
  });

  it("has no suggested day and no pending items once fresh items are pushed", async () => {
    await client.shoppingItem.updateMany({
      where: { source: "recipe", category: "frisch" },
      data: { pushed: true },
    });
    const state = await getFreshShoppingState(client);
    expect(state.pendingItems).toEqual([]);
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

Run: `npx vitest run src/lib/repositories/shopping.test.ts`
Expected: FAIL — `getFreshShoppingState` not exported.

- [ ] **Step 4: Implement** — in `src/lib/repositories/shopping.ts`.

Imports ergänzen:
```ts
import type { ShoppingItem, FreshShoppingState } from "@/lib/domain";
import { currentWeekBounds } from "@/lib/dates";
import { classifyFreshness, suggestFreshShoppingDay } from "@/lib/services/freshness";
```
(die bestehende `import type { ShoppingItem } ...`-Zeile entsprechend zusammenfassen.)

Am Dateiende anfügen:
```ts
/**
 * Frische-Einkaufs-Zustand fürs Dashboard: die offenen, noch nicht gepushten
 * Frisch-Rezept-Items plus ein Vorschlagstag (Tag vor dem frühesten Verbrauch
 * einer Frisch-Zutat im aktiven Wochenplan).
 */
export async function getFreshShoppingState(
  client: PrismaClient = prisma,
): Promise<FreshShoppingState> {
  const pendingRows = await client.shoppingItem.findMany({
    where: { source: "recipe", category: "frisch", pushed: false, done: false },
    orderBy: { createdAt: "asc" },
  });
  const pendingItems = pendingRows.map((r) => r.text);

  const { start, end } = currentWeekBounds();
  const entries = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end }, status: "active" },
    include: { recipe: { include: { ingredients: true } } },
    orderBy: { date: "asc" },
  });

  let earliest: Date | null = null;
  for (const entry of entries) {
    const hasFresh = entry.recipe.ingredients.some(
      (i) => (i.category ?? classifyFreshness(i.name)) === "frisch",
    );
    if (hasFresh) {
      earliest = entry.date;
      break; // entries are ordered by date asc
    }
  }

  const suggested = suggestFreshShoppingDay(earliest);
  return { pendingItems, suggestedDayISO: suggested ? suggested.toISOString() : null };
}
```

- [ ] **Step 5: Run, verify PASS** + typecheck

Run: `npx vitest run src/lib/repositories/shopping.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/data.ts web/src/lib/domain.ts web/src/lib/repositories/shopping.ts web/src/lib/repositories/shopping.test.ts
git commit -m "feat: getFreshShoppingState + FreshShoppingState DTO"
```

---

## Task 7: Server Actions — approve pusht nur haltbar; `pushFreshBatchAction`; Platzhalter entfernen

**Files:** Modify `src/app/actions/meals.ts`; Delete `src/lib/services/shoppingBatches.ts`, `src/lib/services/shoppingBatches.test.ts`

- [ ] **Step 1: Delete the C1 placeholder**

```bash
git rm web/src/lib/services/shoppingBatches.ts web/src/lib/services/shoppingBatches.test.ts
```

- [ ] **Step 2: Rewrite the relevant parts of `src/app/actions/meals.ts`**

Ersetze den Import von `planShoppingBatches`/`pushShoppingList` und die `ApprovePlanResult`-Definition und `approveDraftAction`, und ergänze `pushFreshBatchAction`.

(a) Importe: entferne
```ts
import { planShoppingBatches } from "@/lib/services/shoppingBatches";
```
und
```ts
import { pushShoppingList, type BringPushResult } from "@/integrations/bring/client";
```
und ersetze sie durch:
```ts
import { pushRecipeBatch } from "@/lib/services/shoppingBatch";
import { getFreshShoppingState } from "@/lib/repositories/shopping";
import type { BringPushResult } from "@/integrations/bring/client";
import type { FreshShoppingState } from "@/lib/domain";
```
(`syncIngredientsToShopping` bleibt importiert; `getActivePhase`, `getDomeShiftsForWeek`, `localStorage`-frei wie gehabt.)

(b) `ApprovePlanResult` ersetzen:
```ts
/** Result of approving a draft: the haltbar push outcome + the pending fresh state. */
export interface ApprovePlanResult {
  /** `false` when there was no draft to approve. */
  approved: boolean;
  /** Haltbar ingredient names pushed to Bring (empty if not approved) — for the copy fallback. */
  ingredients: string[];
  /** Outcome of pushing the *haltbar* batch to Bring! (never throws). */
  bring: BringPushResult;
  /** Pending fresh batch (items + suggested day) to surface in the dashboard. */
  fresh: FreshShoppingState;
}
```

(c) `approveDraftAction` ersetzen:
```ts
/**
 * Approves the week's draft: promotes it to the active plan, syncs its
 * ingredients onto the shopping list, then pushes ONLY the "haltbar" batch to
 * Bring! immediately. The "frisch" batch stays pending and is surfaced via the
 * returned `fresh` state (pushed later by the user). A Bring failure does NOT
 * undo the approval.
 */
export async function approveDraftAction(weekStartISO: string): Promise<ApprovePlanResult> {
  const weekStart = new Date(weekStartISO);
  const approved = await approveDraft(weekStart);
  if (!approved) {
    revalidatePath("/");
    return {
      approved: false,
      ingredients: [],
      bring: { ok: true, pushed: 0 },
      fresh: { pendingItems: [], suggestedDayISO: null },
    };
  }

  // syncIngredientsToShopping operates on the current ISO week (see shoppingSync);
  // in C1/D1 the UI only ever approves the current week's draft.
  await syncIngredientsToShopping();
  const haltbar = await pushRecipeBatch("haltbar");
  const fresh = await getFreshShoppingState();

  revalidatePath("/");
  return { approved: true, ingredients: haltbar.items, bring: haltbar.bring, fresh };
}

/**
 * Pushes the pending "frisch" batch to Bring! (the deferred second shopping run).
 * Returns the push outcome + the affected names for the copy fallback.
 */
export async function pushFreshBatchAction(): Promise<{ bring: BringPushResult; items: string[] }> {
  const result = await pushRecipeBatch("frisch");
  revalidatePath("/");
  return result;
}
```

(d) Den Datei-Kopfkommentar anpassen: statt „… batch-fähig (`planShoppingBatches`; C1 eine Rutsche) …" →
„… Abnicken pusht nur die **haltbar**-Rutsche sofort auf Bring; die **frisch**-Rutsche folgt später per `pushFreshBatchAction` (Roadmap D1)."

- [ ] **Step 3: typecheck + full suite**

Run: `npm run typecheck`
Expected: clean (keine Referenzen mehr auf `planShoppingBatches`/`shoppingBatches`).
Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/actions/meals.ts web/src/lib/services/shoppingBatches.ts web/src/lib/services/shoppingBatches.test.ts
git commit -m "feat: approve pusht nur haltbar + pushFreshBatchAction; planShoppingBatches entfernt"
```

---

## Task 8: UI — `FreshShoppingControl` + Verdrahtung

**Files:** Create `src/components/FreshShoppingControl.tsx`; Modify `src/app/page.tsx`, `src/components/dashboard.tsx`

- [ ] **Step 1: Create `src/components/FreshShoppingControl.tsx`**

```tsx
"use client";

// Frische-Einkauf (Roadmap D1): zeigt die noch offene Frisch-Rutsche mit einem
// Vorschlagstag und einem Knopf, der sie auf Bring pusht (gestaffelter zweiter
// Einkauf nah am Verbrauch). Nur sichtbar, wenn offene Frisch-Items existieren.

import { useState, useTransition } from "react";

import type { FreshShoppingState } from "@/lib/data";
import { pushFreshBatchAction } from "@/app/actions/meals";
import type { BringPushResult } from "@/integrations/bring/client";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

export function FreshShoppingControl({ fresh }: { fresh: FreshShoppingState }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ bring: BringPushResult; items: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  if (fresh.pendingItems.length === 0) return null;

  const dayLabel = fresh.suggestedDayISO ? WEEKDAYS[new Date(fresh.suggestedDayISO).getDay()] : null;

  const handlePush = () => {
    setCopied(false);
    startTransition(async () => {
      setResult(await pushFreshBatchAction());
    });
  };

  const handleCopy = () => {
    const text = fresh.pendingItems.map((name) => `• ${name}`).join("\n");
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  };

  const bringFailed = result != null && !result.bring.ok;

  return (
    <div className="rounded-3xl bg-white/80 dark:bg-white/[0.04] ring-1 ring-sky-300/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Frische-Einkauf{dayLabel ? ` · Vorschlag ${dayLabel}` : ""}
        </div>
        <button
          type="button"
          onClick={handlePush}
          disabled={pending}
          className={`${PILL} text-sky-700 bg-sky-50 dark:bg-sky-500/15 dark:text-sky-300 hover:bg-sky-100 disabled:cursor-wait`}
        >
          {pending ? "…" : result?.bring.ok ? `✓ ${result.bring.pushed} an Bring` : "Jetzt auf Bring"}
        </button>
      </div>
      <p className="text-[13px] text-ink-soft dark:text-cream/70">{fresh.pendingItems.join(" · ")}</p>
      {bringFailed && (
        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 text-[11px] font-semibold text-ink-faint hover:text-ink-soft underline decoration-dotted underline-offset-2"
        >
          {copied ? "Zutaten kopiert ✓" : "Bring fehlte — Zutaten zum Einfügen kopieren"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `src/app/page.tsx`**

- Import ergänzen:
```ts
import { getShoppingItems, getFreshShoppingState } from "@/lib/repositories/shopping";
```
(die bestehende `import { getShoppingItems } ...`-Zeile ersetzen.)
- Im `Promise.all` einen Eintrag `fresh` ergänzen (Destrukturierung + Array, Reihenfolge konsistent), z. B. direkt nach `shopping`:
```ts
    getShoppingItems(),
    getFreshShoppingState(),
```
und in der Destrukturierung `shopping, fresh,` (an gleicher Position).
- An `<Dashboard ...>` zusätzlich: `fresh={fresh}`.

- [ ] **Step 3: Wire `src/components/dashboard.tsx`**

- Typ-Import erweitern: `FreshShoppingState` zur bestehenden `@/lib/data`-Import-Zeile hinzufügen.
- `import { FreshShoppingControl } from "@/components/FreshShoppingControl";`
- `DashboardProps` um `fresh: FreshShoppingState;` ergänzen; in der Destrukturierung `fresh,` ergänzen.
- Die bedingte Sektion **nach** der Entwurf-Panel-Sektion (bzw. nach der Widget-Row, falls kein Draft-Block dort steht) einfügen:
```tsx
        {fresh.pendingItems.length > 0 && (
          <section className="mt-4 sm:mt-5">
            <FreshShoppingControl fresh={fresh} />
          </section>
        )}
```

- [ ] **Step 4: typecheck + lint + build + test**

Run: `npm run typecheck` → clean.
Run: `npm run lint` → clean.
Run: `npm run build` → „Compiled successfully".
Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/FreshShoppingControl.tsx web/src/app/page.tsx web/src/components/dashboard.tsx
git commit -m "feat: FreshShoppingControl (Frische-Rutsche manuell auf Bring)"
```

---

## Task 9: Manuelle Verifikation

**Files:** keine (nur Beobachtung)

- [ ] **Step 1: Seed**

Run: `npx tsx prisma/seed.ts`
Expected: „Seed completed."

- [ ] **Step 2: Dev-Server, Plan abnicken**

Run: `npm run dev` (Port 3001). „Woche neu planen" → im Entwurf-Panel „Abnicken".
Expected:
- Bring-Pille am Abnicken nennt die **haltbar**-Anzahl (oder Kopier-Fallback, falls Bring nicht konfiguriert).
- Unter dem Dashboard erscheint **„Frische-Einkauf · Vorschlag <Tag>"** mit den Frisch-Zutaten + Knopf „Jetzt auf Bring".

- [ ] **Step 3: Frische pushen**

„Jetzt auf Bring" klicken.
Expected: Pille „✓ N an Bring" (oder Kopier-Fallback); danach verschwindet das Control (keine offenen Frisch-Items mehr).

- [ ] **Step 4: dev.db zurücksetzen**

Run: `npx tsx prisma/seed.ts`
Expected: „Seed completed."

---

## Self-Review (durch den Plan-Autor bereits erfolgt)

- **Spec-Abdeckung:** Schema Kategorie/pushed (T1) · `classifyFreshness`/`suggestFreshShoppingDay` (T2) · Seed-Kategorien (T3) · sync taggt Kategorie+pushed (T4) · `pushRecipeBatch` pusht+markiert eine Rutsche (T5) · `getFreshShoppingState` + DTO (T6) · approve pusht nur haltbar, `pushFreshBatchAction`, Platzhalter entfernt (T7) · `FreshShoppingControl` + Verdrahtung (T8) · Vorschlagstag = Tag vor frühestem Frisch-Verbrauch (T2+T6) · Bring-Fehler markiert nicht (T5).
- **Typen-Konsistenz:** `category`/`pushed` überall gleich; `Freshness` = "frisch"|"haltbar"; `pushRecipeBatch(category, client?, push?)` → `{bring, items}`; `FreshShoppingState {pendingItems, suggestedDayISO}` (data.ts) → repo/action/UI; `ApprovePlanResult` um `fresh` erweitert; injizierbarer `push` (Default `pushShoppingList`).
- **Bewusst außerhalb Scope:** D2 (Kalender „auf dem Weg"), D3 (Aufgabe/Konto), Editier-UI für Kategorien, >2 Stufen.
