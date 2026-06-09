# Essensplan-Entwurf + Abnicken/Ändern (Roadmap C1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein generierter Wochenplan wird zunächst ein *Entwurf*; Dome oder Emely nicken ihn ab oder ändern ihn (Tag tauschen / Tag neu würfeln). Erst beim Abnicken wird er aktiv und die Zutaten gehen (batch-fähig) auf Einkaufsliste + Bring.

**Architecture:** Ein `status`-Feld ("active" | "draft") auf `MealPlanEntry` lässt aktiven Plan und Entwurf pro Woche koexistieren. Reine Helfer (`constraintFromEntry`, `planShoppingBatches`) plus Draft-Lifecycle-Services (approve/reroll/swap/discard) hinter Server Actions; ein neues `MealDraftPanel` zeigt/bearbeitet den Entwurf, die Essensplan-Kachel bleibt der aktive Plan. DB/Next außen herum, „reiner Mapper + Unit-Test"-Muster.

**Tech Stack:** TypeScript, Next.js (App Router, Server Actions), Prisma + SQLite (better-sqlite3), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-essensplan-entwurf-freigabe-design.md`

**Working directory for all commands:** `web/` (alle Pfade relativ zu `web/`). Git-Commits vom Repo-Root `c:\Users\ThinkPad\Documents\Claude\Dashboard` (Pfade als `web/...`).

---

## File Structure

- **Modify** `prisma/schema.prisma` — `MealPlanEntry.status`.
- **Modify** `src/lib/services/mealConstraints.ts` — reine `constraintFromEntry`.
- **Modify** `src/lib/services/mealConstraints.test.ts` — Tests dafür.
- **Create** `src/lib/services/shoppingBatches.ts` — reine `planShoppingBatches` (D-Naht).
- **Create** `src/lib/services/shoppingBatches.test.ts`.
- **Modify** `src/lib/services/mealPlanner.ts` — `generateWeekPlan` schreibt Entwurf; `candidatesFor` exportieren; `weekBoundsOf` aus `@/lib/dates`.
- **Modify** `src/lib/services/mealPlanner.test.ts` — angepasste Statuserwartung.
- **Modify** `src/lib/dates.ts` — `weekBoundsOf` exportieren.
- **Create** `src/lib/services/mealDraft.ts` — `approveDraft`/`discardDraft`/`rerollDraftDay`/`setDraftDayRecipe`.
- **Create** `src/lib/services/mealDraft.test.ts`.
- **Modify** `src/lib/data.ts` — `DraftMeal`, `RecipeOption`.
- **Modify** `src/lib/repositories/meals.ts` — `getWeekMealPlan` (active-Filter), `getDraftMealPlan`, `listRecipes`.
- **Modify** `src/lib/repositories/meals.test.ts` — Tests dafür.
- **Modify** `src/lib/services/shoppingSync.ts` — active-Filter.
- **Modify** `src/lib/services/shoppingSync.test.ts` — Test ergänzen.
- **Modify** `src/app/actions/meals.ts` — Draft-/Approve-/Edit-Actions.
- **Create** `src/components/MealDraftPanel.tsx` — Entwurfs-Ansicht.
- **Modify** `src/components/widgets.tsx` — `MealReasonBadge` extrahieren.
- **Modify** `src/components/MealPlanControl.tsx` — erzeugt jetzt den Entwurf.
- **Modify** `src/components/dashboard.tsx` — Entwurf + Rezepte als Props, Panel rendern.
- **Modify** `src/app/page.tsx` — Entwurf + Rezeptliste laden.

---

## Task 1: Schema — `MealPlanEntry.status`

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Edit schema** — in `model MealPlanEntry` ein Feld ergänzen (nach `extraPortion`):

```prisma
model MealPlanEntry {
  id           String   @id @default(cuid())
  date         DateTime
  reason       String? // "emely-allein" | "aufwaermen-extra" | null
  extraPortion Boolean  @default(false)
  status       String   @default("active") // "active" | "draft"

  recipeId String
  recipe   Recipe @relation(fields: [recipeId], references: [id])
}
```

- [ ] **Step 2: Migration + Client neu generieren**

Run: `node node_modules/prisma/build/index.js migrate dev --name meal_plan_status`
Then: `node node_modules/prisma/build/index.js generate`
Expected: Migration `*_meal_plan_status` angelegt/angewandt; „Generated Prisma Client".

- [ ] **Step 3: Full suite (Test-DB nimmt Migration über globalSetup auf)**

Run: `npm test`
Expected: PASS (Seed-Einträge sind durch den Default `active`, bestehende Anzeige unverändert).

- [ ] **Step 4: Commit**

```bash
git add web/prisma/schema.prisma web/prisma/migrations
git commit -m "feat: MealPlanEntry.status (active/draft) fuer Entwurfs-Plan"
```

---

## Task 2: Pure `constraintFromEntry`

**Files:** Modify `src/lib/services/mealConstraints.ts`, Test `src/lib/services/mealConstraints.test.ts`

- [ ] **Step 1: Write the failing test** — am Ende von `mealConstraints.test.ts` anfügen (Import oben um `constraintFromEntry` ergänzen):

Ändere die Importzeile `import { deriveDayConstraints } from "./mealConstraints";` zu
`import { constraintFromEntry, deriveDayConstraints } from "./mealConstraints";`

```ts
describe("constraintFromEntry", () => {
  it("reconstructs needsSimple/needsReheatable losslessly from a stored entry", () => {
    expect(constraintFromEntry("emely-allein", false)).toEqual({
      needsSimple: true,
      needsReheatable: false,
    });
    expect(constraintFromEntry("aufwaermen-extra", true)).toEqual({
      needsSimple: false,
      needsReheatable: true,
    });
    // Konflikt-Tag: reason emely-allein + extraPortion true → beide true
    expect(constraintFromEntry("emely-allein", true)).toEqual({
      needsSimple: true,
      needsReheatable: true,
    });
    // Kein Constraint
    expect(constraintFromEntry(null, false)).toEqual({
      needsSimple: false,
      needsReheatable: false,
    });
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/lib/services/mealConstraints.test.ts`
Expected: FAIL — `constraintFromEntry` not exported.

- [ ] **Step 3: Implement** — in `src/lib/services/mealConstraints.ts` am Dateiende anfügen:

```ts
/**
 * Rekonstruiert `{ needsSimple, needsReheatable }` verlustfrei aus einem
 * gespeicherten Eintrag. Gilt, weil `deriveDayConstraints` immer
 * `extraPortion === needsReheatable` setzt und `reason === "emely-allein"`
 * genau `needsSimple` markiert. Wird vom Re-Roll eines Entwurfs-Tages genutzt.
 */
export function constraintFromEntry(
  reason: string | null,
  extraPortion: boolean,
): { needsSimple: boolean; needsReheatable: boolean } {
  return {
    needsSimple: reason === "emely-allein",
    needsReheatable: extraPortion,
  };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/lib/services/mealConstraints.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/mealConstraints.ts web/src/lib/services/mealConstraints.test.ts
git commit -m "feat: constraintFromEntry (Constraint aus Eintrag rekonstruieren)"
```

---

## Task 3: Pure `planShoppingBatches` (D-Naht)

**Files:** Create `src/lib/services/shoppingBatches.ts`, Test `src/lib/services/shoppingBatches.test.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/services/shoppingBatches.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { planShoppingBatches } from "./shoppingBatches";

describe("planShoppingBatches", () => {
  it("C1: returns a single batch with all ingredients, mapped to Bring items", () => {
    const batches = planShoppingBatches(["Nudeln", "Tomaten", "Reis"]);
    expect(batches).toHaveLength(1);
    expect(batches[0].items).toEqual([
      { name: "Nudeln" },
      { name: "Tomaten" },
      { name: "Reis" },
    ]);
  });

  it("returns an empty batch list when there are no ingredients", () => {
    expect(planShoppingBatches([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/lib/services/shoppingBatches.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `src/lib/services/shoppingBatches.ts`:

```ts
// Einkaufs-Rutschen (Batches) für den Bring-Push beim Abnicken.
//
// SCHRITT-D-NAHT (siehe Spec 2026-06-09): Heute (C1) wird der Wochenplan in
// GENAU EINER Rutsche eingekauft. Schritt D ersetzt nur diese Funktion und
// gruppiert die Zutaten nach Haltbarkeit/Einkaufstermin in mehrere Batches
// (dann ggf. je mit Datum/Label). Der Approve-Flow iteriert die Batches und
// pusht jede einzeln — diese Schleife bleibt für D unverändert.

import type { BringItem } from "@/integrations/bring/client";

export interface IngredientBatch {
  /** Optionales Label/Datum (für Schritt D); in C1 ungenutzt. */
  label?: string;
  items: BringItem[];
}

/**
 * Gruppiert Zutaten-Namen in Einkaufs-Rutschen. C1: eine Rutsche mit allen
 * Zutaten (leere Liste → keine Rutsche). Reine Funktion, kein DB/Netz.
 */
export function planShoppingBatches(ingredientNames: string[]): IngredientBatch[] {
  if (ingredientNames.length === 0) return [];
  return [{ items: ingredientNames.map((name) => ({ name })) }];
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/lib/services/shoppingBatches.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/shoppingBatches.ts web/src/lib/services/shoppingBatches.test.ts
git commit -m "feat: planShoppingBatches (C1 eine Rutsche, Naht fuer Schritt D)"
```

---

## Task 4: Planner schreibt Entwurf + `candidatesFor` exportieren

**Files:** Modify `src/lib/services/mealPlanner.ts`, `src/lib/services/mealPlanner.test.ts`

- [ ] **Step 1: Update the existing "replace" test to expect drafts**

In `src/lib/services/mealPlanner.test.ts`, im Test
`"re-running generateWeekPlan replaces the existing plan (still 5, not 10)"`
die finale Query auf den Entwurfs-Status eingrenzen. Ersetze:
```ts
    const all = await client.mealPlanEntry.findMany({ where: { date: { gte: start, lte: end } } });
    expect(all).toHaveLength(5);
```
durch:
```ts
    const drafts = await client.mealPlanEntry.findMany({
      where: { date: { gte: start, lte: end }, status: "draft" },
    });
    expect(drafts).toHaveLength(5);
```

Außerdem im selben Block einen neuen Test anfügen, der belegt, dass aktive Einträge unberührt bleiben:
```ts
  it("generateWeekPlan writes drafts and leaves seeded active entries intact", async () => {
    const today = new Date();
    await generateWeekPlan(today, { preferSimple: false }, client, identityRng);

    const { start, end } = (await import("@/lib/dates")).currentWeekBounds();
    const active = await client.mealPlanEntry.findMany({
      where: { date: { gte: start, lte: end }, status: "active" },
    });
    const drafts = await client.mealPlanEntry.findMany({
      where: { date: { gte: start, lte: end }, status: "draft" },
    });
    expect(active).toHaveLength(5); // seed plan untouched
    expect(drafts).toHaveLength(5); // freshly generated draft
  });
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/lib/services/mealPlanner.test.ts`
Expected: FAIL — generateWeekPlan still deletes/creates without status.

- [ ] **Step 3: Implement** — in `src/lib/services/mealPlanner.ts`:

(a) `candidatesFor` exportieren: das Schlüsselwort `export` vor die Funktion setzen:
```ts
export function candidatesFor(
  c: DayConstraint,
  base: Recipe[],
  preferSimple: boolean,
): Recipe[] {
```

(b) In `generateWeekPlan`, den Replace-Delete auf Entwürfe eingrenzen und Einträge als Entwurf erstellen. Ersetze:
```ts
  await client.mealPlanEntry.deleteMany({ where: { date: { gte: monday, lte: sunday } } });
```
durch:
```ts
  await client.mealPlanEntry.deleteMany({
    where: { date: { gte: monday, lte: sunday }, status: "draft" },
  });
```
und im `create`-Aufruf `status: "draft"` ergänzen:
```ts
    const entry = await client.mealPlanEntry.create({
      data: {
        date: weekdayDates[i],
        recipeId: pick.id,
        reason: c.reason,
        extraPortion: c.extraPortion,
        status: "draft",
      },
    });
```

(c) Den Doc-Kommentar von `generateWeekPlan` anpassen: statt „Generates (and persists) the Mon–Fr meal plan … replacing any existing entries" →
„Generates (and persists) the Mon–Fr meal plan **as a draft** (`status:"draft"`) for the week, replacing any existing **draft** for that week. The active plan and the shopping list are untouched — promotion happens via `approveDraft`."

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run src/lib/services/mealPlanner.test.ts`
Expected: PASS (alle, inkl. der angepassten/neuen Status-Tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/mealPlanner.ts web/src/lib/services/mealPlanner.test.ts
git commit -m "feat: generateWeekPlan erzeugt Entwurf (status draft) + candidatesFor exportiert"
```

---

## Task 5: `weekBoundsOf` + Draft-Lifecycle (`approveDraft`, `discardDraft`)

**Files:** Modify `src/lib/dates.ts`, `src/lib/services/mealPlanner.ts`; Create `src/lib/services/mealDraft.ts`, `src/lib/services/mealDraft.test.ts`

- [ ] **Step 1: Export `weekBoundsOf` from dates.ts and reuse it in the planner**

In `src/lib/dates.ts` nach `mondayOf` anfügen:
```ts
/** Returns the Monday 00:00 → Sunday 23:59:59.999 bounds of the local ISO week containing `date`. */
export function weekBoundsOf(date: Date): { start: Date; end: Date } {
  const start = mondayOf(date);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
```
In `src/lib/services/mealPlanner.ts`: die lokale private `function weekBoundsOf(...)` LÖSCHEN und stattdessen importieren — die dates-Importzeile
`import { addDays, mondayOf } from "@/lib/dates";` zu
`import { addDays, weekBoundsOf } from "@/lib/dates";` ändern (mondayOf wird dort dann nicht mehr direkt gebraucht; falls ein Lint-Fehler „unused" kommt, mondayOf entfernen).

- [ ] **Step 2: Write the failing test** — `src/lib/services/mealDraft.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { currentWeekBounds } from "@/lib/dates";
import { generateWeekPlan } from "./mealPlanner";

import { approveDraft, discardDraft } from "./mealDraft";

describe("mealDraft lifecycle", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  async function weekCounts() {
    const { start, end } = currentWeekBounds();
    const active = await client.mealPlanEntry.count({
      where: { date: { gte: start, lte: end }, status: "active" },
    });
    const draft = await client.mealPlanEntry.count({
      where: { date: { gte: start, lte: end }, status: "draft" },
    });
    return { active, draft };
  }

  it("approveDraft replaces the active plan with the draft and clears the draft", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    expect(await weekCounts()).toEqual({ active: 5, draft: 5 });

    const ok = await approveDraft(new Date(), client);
    expect(ok).toBe(true);
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 });
  });

  it("approveDraft is a no-op (false) when there is no draft", async () => {
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 }); // seed only
    const ok = await approveDraft(new Date(), client);
    expect(ok).toBe(false);
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 });
  });

  it("discardDraft removes only the draft, leaving the active plan", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    await discardDraft(new Date(), client);
    expect(await weekCounts()).toEqual({ active: 5, draft: 0 });
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

Run: `npx vitest run src/lib/services/mealDraft.test.ts`
Expected: FAIL — module `./mealDraft` not found.

- [ ] **Step 4: Implement** — `src/lib/services/mealDraft.ts`:

```ts
// Draft-Lifecycle des Wochen-Essensplans: einen erzeugten Entwurf abnicken
// (→ aktiv) oder verwerfen, und einzelne Entwurfs-Tage bearbeiten. Aktiver Plan
// und Entwurf koexistieren über `MealPlanEntry.status` ("active" | "draft").

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { weekBoundsOf } from "@/lib/dates";

/**
 * Befördert den Entwurf der Woche zum aktiven Plan: löscht die aktiven Einträge
 * der Woche und setzt die Entwurfs-Einträge auf `status:"active"` — in einer
 * Transaktion. Gibt `false` zurück (no-op), wenn es keinen Entwurf gibt.
 */
export async function approveDraft(
  weekStart: Date,
  client: PrismaClient = prisma,
): Promise<boolean> {
  const { start, end } = weekBoundsOf(weekStart);
  const draftCount = await client.mealPlanEntry.count({
    where: { date: { gte: start, lte: end }, status: "draft" },
  });
  if (draftCount === 0) return false;

  await client.$transaction([
    client.mealPlanEntry.deleteMany({
      where: { date: { gte: start, lte: end }, status: "active" },
    }),
    client.mealPlanEntry.updateMany({
      where: { date: { gte: start, lte: end }, status: "draft" },
      data: { status: "active" },
    }),
  ]);
  return true;
}

/** Verwirft den Entwurf der Woche (löscht nur `status:"draft"`-Einträge). */
export async function discardDraft(
  weekStart: Date,
  client: PrismaClient = prisma,
): Promise<void> {
  const { start, end } = weekBoundsOf(weekStart);
  await client.mealPlanEntry.deleteMany({
    where: { date: { gte: start, lte: end }, status: "draft" },
  });
}
```

- [ ] **Step 5: Run, verify PASS** + typecheck

Run: `npx vitest run src/lib/services/mealDraft.test.ts src/lib/services/mealPlanner.test.ts`
Expected: PASS (mealPlanner weiterhin grün nach dem weekBoundsOf-Umzug).
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/dates.ts web/src/lib/services/mealPlanner.ts web/src/lib/services/mealDraft.ts web/src/lib/services/mealDraft.test.ts
git commit -m "feat: approveDraft/discardDraft + weekBoundsOf zentralisiert"
```

---

## Task 6: Entwurfs-Tag bearbeiten (`rerollDraftDay`, `setDraftDayRecipe`)

**Files:** Modify `src/lib/services/mealDraft.ts`, `src/lib/services/mealDraft.test.ts`

- [ ] **Step 1: Write the failing test** — in `mealDraft.test.ts` Imports erweitern und einen Block anfügen.

Importzeile ergänzen:
```ts
import { approveDraft, discardDraft, rerollDraftDay, setDraftDayRecipe } from "./mealDraft";
```
Block anfügen:
```ts
describe("mealDraft editing", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  // rng=0 → erstes Element; reroll soll bei mehreren Kandidaten ein ANDERES
  // Rezept als das aktuelle wählen.
  const zeroRng = () => 0;

  async function draftMondayEntry() {
    const { start } = currentWeekBounds();
    const monday = new Date(start);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday, lte: end }, status: "draft" },
      include: { recipe: true },
      orderBy: { date: "asc" },
    });
  }

  it("rerollDraftDay swaps to a different recipe and keeps reason/extraPortion", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const before = await draftMondayEntry();

    const updated = await rerollDraftDay(before.date, false, client, zeroRng);
    expect(updated).not.toBeNull();
    expect(updated!.recipeId).not.toBe(before.recipeId); // changed
    expect(updated!.reason).toBe(before.reason); // unchanged
    expect(updated!.extraPortion).toBe(before.extraPortion); // unchanged
    expect(updated!.status).toBe("draft");
  });

  it("rerollDraftDay on a needsSimple day still picks a simple recipe", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const monday = await draftMondayEntry();
    // Force the day into a "needsSimple" constraint.
    await client.mealPlanEntry.update({
      where: { id: monday.id },
      data: { reason: "emely-allein", extraPortion: false },
    });

    const updated = await rerollDraftDay(monday.date, false, client, zeroRng);
    const recipe = await client.recipe.findUniqueOrThrow({ where: { id: updated!.recipeId } });
    expect(recipe.simple).toBe(true);
  });

  it("setDraftDayRecipe sets exactly the chosen recipe on the draft entry", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const monday = await draftMondayEntry();
    const pizza = await client.recipe.findFirstOrThrow({ where: { name: "Pizzaabend" } });

    const updated = await setDraftDayRecipe(monday.date, pizza.id, client);
    expect(updated!.recipeId).toBe(pizza.id);
    expect(updated!.status).toBe("draft");
  });

  it("editing functions return null when there is no draft entry for the day", async () => {
    // No draft generated → seeded active only.
    const { start } = currentWeekBounds();
    expect(await setDraftDayRecipe(new Date(start), "whatever", client)).toBeNull();
    expect(await rerollDraftDay(new Date(start), false, client, zeroRng)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run src/lib/services/mealDraft.test.ts`
Expected: FAIL — `rerollDraftDay`/`setDraftDayRecipe` not exported.

- [ ] **Step 3: Implement** — in `src/lib/services/mealDraft.ts` Imports erweitern und Funktionen anfügen:

Importe oben ergänzen:
```ts
import type { MealPlanEntry, Recipe } from "@/generated/prisma/client";
import { dayBounds } from "@/lib/dates";
import { candidatesFor } from "./mealPlanner";
import { constraintFromEntry, type DayConstraint, type MealReason } from "./mealConstraints";
```
(Die bestehende Zeile `import { weekBoundsOf } from "@/lib/dates";` zu
`import { dayBounds, weekBoundsOf } from "@/lib/dates";` zusammenfassen.)

Funktionen anfügen:
```ts
/** Findet den Entwurfs-Eintrag (`status:"draft"`) am lokalen Tag von `date`. */
async function findDraftEntryForDay(date: Date, client: PrismaClient) {
  const { start, end } = dayBounds(date);
  return client.mealPlanEntry.findFirst({
    where: { date: { gte: start, lte: end }, status: "draft" },
  });
}

/**
 * Würfelt das Rezept eines Entwurfs-Tages neu — dienstbewusst: rekonstruiert den
 * Tages-Constraint aus dem Eintrag, nutzt dieselbe Pool-Logik wie der Planer und
 * schließt das aktuelle Rezept möglichst aus. `reason`/`extraPortion` bleiben.
 * Gibt `null`, wenn es keinen Entwurfs-Eintrag für den Tag gibt.
 */
export async function rerollDraftDay(
  date: Date,
  preferSimple: boolean,
  client: PrismaClient = prisma,
  rng: () => number = Math.random,
): Promise<MealPlanEntry | null> {
  const entry = await findDraftEntryForDay(date, client);
  if (!entry) return null;

  const recipes: Recipe[] = await client.recipe.findMany({ orderBy: { name: "asc" } });
  const { needsSimple, needsReheatable } = constraintFromEntry(entry.reason, entry.extraPortion);
  const constraint: DayConstraint = {
    date: entry.date,
    needsSimple,
    needsReheatable,
    extraPortion: entry.extraPortion,
    reason: entry.reason as MealReason | null,
  };

  const pool = candidatesFor(constraint, recipes, preferSimple);
  const others = pool.filter((r) => r.id !== entry.recipeId);
  const choices = others.length > 0 ? others : pool;
  const pick = choices[Math.floor(rng() * choices.length)];

  return client.mealPlanEntry.update({
    where: { id: entry.id },
    data: { recipeId: pick.id },
  });
}

/**
 * Setzt manuell das Rezept eines Entwurfs-Tages (Tausch aus dem Rezeptbuch).
 * Gibt `null`, wenn es keinen Entwurfs-Eintrag für den Tag gibt.
 */
export async function setDraftDayRecipe(
  date: Date,
  recipeId: string,
  client: PrismaClient = prisma,
): Promise<MealPlanEntry | null> {
  const entry = await findDraftEntryForDay(date, client);
  if (!entry) return null;
  return client.mealPlanEntry.update({
    where: { id: entry.id },
    data: { recipeId },
  });
}
```

Hinweis: `DayConstraint` und `MealReason` müssen aus `mealConstraints.ts` exportiert sein. `DayConstraint` ist bereits `export interface`; `MealReason` ist bereits `export type` (in Task B angelegt). Falls nicht exportiert, dort `export` ergänzen.

- [ ] **Step 4: Run, verify PASS** + typecheck

Run: `npx vitest run src/lib/services/mealDraft.test.ts`
Expected: PASS (alle 7 in der Datei).
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/mealDraft.ts web/src/lib/services/mealDraft.test.ts
git commit -m "feat: rerollDraftDay + setDraftDayRecipe (Entwurfs-Tag bearbeiten)"
```

---

## Task 7: DTOs + Repository (active-Filter, getDraftMealPlan, listRecipes) + shoppingSync-Filter

**Files:** Modify `src/lib/data.ts`, `src/lib/repositories/meals.ts`, `src/lib/repositories/meals.test.ts`, `src/lib/services/shoppingSync.ts`, `src/lib/services/shoppingSync.test.ts`

- [ ] **Step 1: Add DTOs to `src/lib/data.ts`** — nach dem `Meal`-Interface:

```ts
export interface DraftMeal {
  /** ISO-Datum des Tages, für Server-Action-Aufrufe. */
  dateISO: string;
  day: string; // "Mo".."Fr"
  dish: string;
  recipeId: string;
  reason?: string | null;
  extraPortion?: boolean;
}

export interface RecipeOption {
  id: string;
  name: string;
}
```

- [ ] **Step 2: Write the failing tests** — in `src/lib/repositories/meals.test.ts`.

Importe oben ergänzen/zusammenfassen (Modul-Importe):
```ts
import { getDomeShiftsForWeek, getDraftMealPlan, getWeekMealPlan, listRecipes } from "./meals";
```
Im `describe("meals repository", ...)` Block diese Tests anfügen:
```ts
  it("getWeekMealPlan returns only active entries (ignores drafts)", async () => {
    const { start } = currentWeekBounds();
    const monday = new Date(start);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const seeded = await client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday, lte: end } },
      orderBy: { date: "asc" },
    });
    // Add a draft entry on the same Monday.
    await client.mealPlanEntry.create({
      data: { date: seeded.date, recipeId: seeded.recipeId, status: "draft" },
    });

    const plan = await getWeekMealPlan(client);
    expect(plan).toHaveLength(5); // still only the 5 active entries
  });

  it("getDraftMealPlan returns only draft entries with dateISO + recipeId", async () => {
    const { start } = currentWeekBounds();
    const monday = new Date(start);
    const seeded = await client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday } },
      orderBy: { date: "asc" },
    });
    await client.mealPlanEntry.create({
      data: {
        date: seeded.date,
        recipeId: seeded.recipeId,
        status: "draft",
        reason: "emely-allein",
        extraPortion: false,
      },
    });

    const draft = await getDraftMealPlan(client);
    expect(draft).toHaveLength(1);
    expect(draft[0].recipeId).toBe(seeded.recipeId);
    expect(draft[0].reason).toBe("emely-allein");
    expect(typeof draft[0].dateISO).toBe("string");
    expect(draft[0].day).toBe("Mo");
  });

  it("listRecipes returns id+name sorted by name", async () => {
    const recipes = await listRecipes(client);
    const names = recipes.map((r) => r.name);
    expect(names).toEqual([...names].sort());
    expect(recipes[0]).toHaveProperty("id");
    expect(recipes[0]).toHaveProperty("name");
  });
```

- [ ] **Step 3: Run, verify FAIL**

Run: `npx vitest run src/lib/repositories/meals.test.ts`
Expected: FAIL — `getDraftMealPlan`/`listRecipes` not exported; getWeekMealPlan not yet filtered.

- [ ] **Step 4: Implement** — in `src/lib/repositories/meals.ts`:

(a) Import des DTO erweitern:
```ts
import type { Meal, DraftMeal, RecipeOption } from "@/lib/domain";
```
Hinweis: `@/lib/domain` re-exportiert die Typen aus `data.ts`. Falls `DraftMeal`/`RecipeOption` dort nicht re-exportiert sind, in `src/lib/domain.ts` zur `export type { ... } from "./data";`-Liste hinzufügen.

(b) `getWeekMealPlan`-Query um `status:"active"` ergänzen:
```ts
  const rows = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end }, status: "active" },
    include: { recipe: true },
    orderBy: { date: "asc" },
  });
```

(c) Am Dateiende anfügen:
```ts
/**
 * Wie `getWeekMealPlan`, aber nur die Entwurfs-Einträge (`status:"draft"`) der
 * aktuellen Woche — inkl. `dateISO` und `recipeId`, damit die Entwurfs-Ansicht
 * einzelne Tage neu würfeln oder das Rezept tauschen kann.
 */
export async function getDraftMealPlan(client: PrismaClient = prisma): Promise<DraftMeal[]> {
  const { start, end } = currentWeekBounds();

  const rows = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end }, status: "draft" },
    include: { recipe: true },
    orderBy: { date: "asc" },
  });

  return rows.map((row) => ({
    dateISO: row.date.toISOString(),
    day: WEEKDAY_LABELS[row.date.getDay()],
    dish: row.recipe.name,
    recipeId: row.recipeId,
    reason: row.reason,
    extraPortion: row.extraPortion,
  }));
}

/** Alle Rezepte als `{ id, name }`, nach Name sortiert — fürs Tausch-Picker. */
export async function listRecipes(client: PrismaClient = prisma): Promise<RecipeOption[]> {
  const recipes = await client.recipe.findMany({ orderBy: { name: "asc" } });
  return recipes.map((r) => ({ id: r.id, name: r.name }));
}
```

- [ ] **Step 5: shoppingSync active-Filter**

In `src/lib/services/shoppingSync.ts` die Query eingrenzen:
```ts
  const entries = await client.mealPlanEntry.findMany({
    where: { date: { gte: start, lte: end }, status: "active" },
    include: { recipe: { include: { ingredients: true } } },
  });
```
In `src/lib/services/shoppingSync.test.ts` einen Test anfügen, der belegt, dass Entwürfe ignoriert werden (Stil an bestehende Tests der Datei anlehnen — Client via `createTestClient`/`resetDatabase`). Konkreter Test:
```ts
  it("ignores draft meal-plan entries (only active recipes feed the list)", async () => {
    // Create a draft entry for a recipe with a distinctive ingredient and
    // verify that ingredient does NOT appear among the synced names.
    const { start } = (await import("@/lib/dates")).currentWeekBounds();
    const recipe = await client.recipe.create({
      data: {
        name: "ZZZ Draft-Only-Gericht",
        simple: true,
        ingredients: { create: [{ name: "Geheimzutat-XYZ", amount: null, unit: null }] },
      },
    });
    await client.mealPlanEntry.create({
      data: { date: new Date(start), recipeId: recipe.id, status: "draft" },
    });

    const names = await syncIngredientsToShopping(client);
    expect(names).not.toContain("Geheimzutat-XYZ");
  });
```
(Falls die Testdatei noch keinen `client`/`beforeEach` hat, am Muster von `meals.test.ts` orientieren: `createTestClient`, `resetDatabase` in `beforeEach`, `syncIngredientsToShopping` mit `client` aufrufen, `import` für `createTestClient`/`resetDatabase`/`PrismaClient` ergänzen.)

- [ ] **Step 6: Run, verify PASS** + typecheck

Run: `npx vitest run src/lib/repositories/meals.test.ts src/lib/services/shoppingSync.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/data.ts web/src/lib/domain.ts web/src/lib/repositories/meals.ts web/src/lib/repositories/meals.test.ts web/src/lib/services/shoppingSync.ts web/src/lib/services/shoppingSync.test.ts
git commit -m "feat: DraftMeal/RecipeOption + active-Filter + getDraftMealPlan/listRecipes"
```

---

## Task 8: Server Actions (Entwurf, Bearbeiten, Abnicken mit Batches, Verwerfen)

**Files:** Modify `src/app/actions/meals.ts`, `src/components/MealPlanControl.tsx`

- [ ] **Step 1: Rewrite `src/app/actions/meals.ts`** — vollständiger neuer Inhalt:

```ts
"use server";

// Server Actions rund um den Wochen-Essensplan-Entwurf (Roadmap C1).
// Erzeugen schreibt einen Entwurf (dienstbewusst, keine Einkauf-Berührung).
// Bearbeiten würfelt einen Tag neu oder tauscht sein Rezept. Abnicken befördert
// den Entwurf zum aktiven Plan und pusht dann die Zutaten — batch-fähig
// (`planShoppingBatches`; C1 eine Rutsche) — auf Einkaufsliste + Bring.

import { revalidatePath } from "next/cache";

import { generateWeekPlan } from "@/lib/services/mealPlanner";
import { deriveDayConstraints } from "@/lib/services/mealConstraints";
import {
  approveDraft,
  discardDraft,
  rerollDraftDay,
  setDraftDayRecipe,
} from "@/lib/services/mealDraft";
import { syncIngredientsToShopping } from "@/lib/services/shoppingSync";
import { planShoppingBatches } from "@/lib/services/shoppingBatches";
import { getActivePhase } from "@/lib/repositories/phase";
import { getDomeShiftsForWeek } from "@/lib/repositories/meals";
import { localDateKey } from "@/lib/dates";
import { pushShoppingList, type BringPushResult } from "@/integrations/bring/client";

/** Result of approving a draft and pushing its ingredients. */
export interface ApprovePlanResult {
  /** `false` when there was no draft to approve. */
  approved: boolean;
  /** Recipe ingredient names written to the list (empty if not approved). */
  ingredients: string[];
  /** Aggregated outcome of pushing the batches to Bring! (never throws). */
  bring: BringPushResult;
}

/** Generates the dienstbewusst DRAFT plan for the week (no shopping/Bring). */
export async function generatePlanAction(weekStart: Date): Promise<void> {
  const phase = await getActivePhase();

  const shifts = await getDomeShiftsForWeek(weekStart);
  const constraints = deriveDayConstraints(
    weekStart,
    (date) => shifts.get(localDateKey(date)) ?? null,
  );

  await generateWeekPlan(weekStart, {
    preferSimple: phase?.mode === "elternzeit",
    constraints,
  });

  revalidatePath("/");
}

/** Re-rolls a single draft day's recipe (dienstbewusst). */
export async function rerollDraftDayAction(dateISO: string): Promise<void> {
  const phase = await getActivePhase();
  await rerollDraftDay(new Date(dateISO), phase?.mode === "elternzeit");
  revalidatePath("/");
}

/** Manually swaps a draft day's recipe. */
export async function setDraftDayRecipeAction(dateISO: string, recipeId: string): Promise<void> {
  await setDraftDayRecipe(new Date(dateISO), recipeId);
  revalidatePath("/");
}

/** Discards the week's draft. */
export async function discardDraftAction(weekStart: Date): Promise<void> {
  await discardDraft(weekStart);
  revalidatePath("/");
}

/**
 * Approves the week's draft: promotes it to the active plan, then syncs its
 * ingredients onto the shopping list and pushes them to Bring! in batches
 * (C1: one batch). Returns the outcome for the UI's confirmation pill /
 * manual-copy fallback. A Bring failure does NOT undo the approval.
 */
export async function approveDraftAction(weekStart: Date): Promise<ApprovePlanResult> {
  const approved = await approveDraft(weekStart);
  if (!approved) {
    revalidatePath("/");
    return { approved: false, ingredients: [], bring: { ok: true, pushed: 0 } };
  }

  const ingredients = await syncIngredientsToShopping();
  const batches = planShoppingBatches(ingredients);

  let bring: BringPushResult = { ok: true, pushed: 0 };
  let pushed = 0;
  for (const batch of batches) {
    const result = await pushShoppingList(batch.items);
    if (!result.ok) {
      bring = result;
      break;
    }
    pushed += result.pushed;
    bring = { ok: true, pushed };
  }

  revalidatePath("/");
  return { approved: true, ingredients, bring };
}
```

- [ ] **Step 2: Keep the build green — update `MealPlanControl.tsx` to the new action shape**

`generatePlanAction` gibt jetzt `void` zurück; `MealPlanControl` darf das alte `GeneratePlanResult` nicht mehr nutzen. Ersetze `src/components/MealPlanControl.tsx` vollständig durch:

```tsx
"use client";

// "Woche neu planen" — erzeugt einen dienstbewussten ENTWURF des Wochenplans
// (Roadmap C1). Der Entwurf erscheint danach im MealDraftPanel zum Abnicken
// oder Ändern; Zutaten/Bring passieren erst beim Abnicken (dort).

import { useState, useTransition } from "react";

import { generatePlanAction } from "@/app/actions/meals";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function MealPlanControl() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const handleGenerate = () => {
    setDone(false);
    startTransition(async () => {
      await generatePlanAction(new Date());
      setDone(true);
    });
  };

  let label = "Woche neu planen";
  let tone = "text-ink-soft bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07]";
  if (pending) {
    label = "Plane …";
  } else if (done) {
    label = "✓ Entwurf erstellt";
    tone = "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300";
  }

  return (
    <button type="button" onClick={handleGenerate} disabled={pending} className={`${PILL} ${tone} disabled:cursor-wait`}>
      {label}
    </button>
  );
}
```

- [ ] **Step 3: typecheck + full suite**

Run: `npm run typecheck`
Expected: clean (keine Verweise mehr auf das entfernte `GeneratePlanResult`).
Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/actions/meals.ts web/src/components/MealPlanControl.tsx
git commit -m "feat: Draft-/Approve-/Edit-Actions; MealPlanControl erzeugt Entwurf"
```

---

## Task 9: UI — `MealReasonBadge` extrahieren + `MealDraftPanel` + Verdrahtung

**Files:** Modify `src/components/widgets.tsx`, `src/components/dashboard.tsx`, `src/app/page.tsx`; Create `src/components/MealDraftPanel.tsx`

- [ ] **Step 1: Extract `MealReasonBadge` in `src/components/widgets.tsx`**

Füge oberhalb von `MealPlanWidget` eine exportierte Badge-Komponente ein, die die in `MealPlanWidget` bereits vorhandene Badge-Logik kapselt:
```tsx
export function MealReasonBadge({ reason, extraPortion }: { reason?: string | null; extraPortion?: boolean }) {
  if (!reason) return null;
  const isAlone = reason === "emely-allein";
  return (
    <span
      className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
        isAlone
          ? "bg-emely-tint text-emely-deep dark:bg-emely/15 dark:text-emely"
          : "bg-cream text-ink-soft dark:bg-white/10 dark:text-cream/70"
      }`}
      title={isAlone ? "Spätdienst Dome — Emely kocht allein" : "Aufwärmbar + Extraportion für Dome"}
    >
      {isAlone ? "Emely allein" : extraPortion ? "Aufwärmen · +Portion" : "Aufwärmen"}
    </span>
  );
}
```
Ersetze in `MealPlanWidget` den vorhandenen Inline-`{m.reason && (...)}`-Block durch:
```tsx
            <MealReasonBadge reason={m.reason} extraPortion={m.extraPortion} />
```
(Das Verhalten/Markup bleibt identisch — nur extrahiert.)

- [ ] **Step 2: Create `src/components/MealDraftPanel.tsx`**

```tsx
"use client";

// Entwurfs-Ansicht des Wochenplans (Roadmap C1): zeigt den Pending-Entwurf
// separat von der (aktiven) Essensplan-Kachel. Pro Tag: Gericht + dienstbewusstes
// Badge, "neu würfeln" und "tauschen". Abnicken befördert den Entwurf zum
// aktiven Plan und pusht die Zutaten auf Bring (mit manuellem Kopier-Fallback).

import { useState, useTransition } from "react";

import type { DraftMeal, RecipeOption } from "@/lib/data";
import {
  approveDraftAction,
  discardDraftAction,
  rerollDraftDayAction,
  setDraftDayRecipeAction,
  type ApprovePlanResult,
} from "@/app/actions/meals";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function MealDraftPanel({ draft, recipes }: { draft: DraftMeal[]; recipes: RecipeOption[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ApprovePlanResult | null>(null);
  const [copied, setCopied] = useState(false);

  const run = (fn: () => Promise<void>) => {
    setResult(null);
    setCopied(false);
    startTransition(fn);
  };

  const handleApprove = () => {
    setCopied(false);
    startTransition(async () => {
      setResult(await approveDraftAction(new Date()));
    });
  };

  const handleCopy = () => {
    if (!result) return;
    const text = result.ingredients.map((name) => `• ${name}`).join("\n");
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  };

  const bringFailed = result?.approved === true && !result.bring.ok;

  return (
    <div className="rounded-3xl bg-white/80 dark:bg-white/[0.04] ring-1 ring-amber-300/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Entwurf · Woche
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => run(() => discardDraftAction(new Date()))}
            disabled={pending}
            className={`${PILL} text-ink-faint bg-cream/60 dark:bg-white/[0.04] hover:bg-cream disabled:cursor-wait`}
          >
            Verwerfen
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending}
            className={`${PILL} text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300 hover:bg-emerald-100 disabled:cursor-wait`}
          >
            {pending ? "…" : result?.bring.ok ? `✓ Abgenickt · ${result.bring.pushed} an Bring` : "Abnicken"}
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {draft.map((m) => (
          <li key={m.dateISO} className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-cream/60 dark:bg-white/[0.03]">
            <span className="shrink-0 w-9 h-9 rounded-full grid place-items-center font-display font-semibold text-[13px] bg-white dark:bg-white/10 text-ink-soft dark:text-cream/60">
              {m.day}
            </span>
            <span className="flex-1 min-w-0 text-[14.5px] text-ink-soft dark:text-cream/70">{m.dish}</span>
            {m.reason && (
              <span
                className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                  m.reason === "emely-allein"
                    ? "bg-emely-tint text-emely-deep dark:bg-emely/15 dark:text-emely"
                    : "bg-cream text-ink-soft dark:bg-white/10 dark:text-cream/70"
                }`}
              >
                {m.reason === "emely-allein" ? "Emely allein" : m.extraPortion ? "Aufwärmen · +Portion" : "Aufwärmen"}
              </span>
            )}
            <button
              type="button"
              onClick={() => run(() => rerollDraftDayAction(m.dateISO))}
              disabled={pending}
              title="Tag neu würfeln"
              className="shrink-0 text-[13px] px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-white/10 disabled:cursor-wait"
            >
              🎲
            </button>
            <select
              value={m.recipeId}
              disabled={pending}
              onChange={(e) => run(() => setDraftDayRecipeAction(m.dateISO, e.target.value))}
              className="shrink-0 text-[12px] rounded-lg bg-white dark:bg-white/10 px-1.5 py-1 max-w-[120px]"
              aria-label="Gericht tauschen"
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

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

- [ ] **Step 3: Wire `page.tsx`** — Entwurf + Rezepte laden und an `Dashboard` geben.

In `src/app/page.tsx`:
- Import ergänzen:
```ts
import { getWeekMealPlan, getDraftMealPlan, listRecipes } from "@/lib/repositories/meals";
```
- Im `Promise.all` zwei Einträge hinzufügen (und in der Destrukturierung):
```ts
  const [
    domeTasks,
    emelyTasks,
    appointments,
    split,
    phase,
    shopping,
    meals,
    draft,
    recipes,
    notes,
    project,
    openTaskCount,
  ] = await Promise.all([
    getTasksByPerson("dome", today),
    getTasksByPerson("emely", today),
    getTodaysEvents(today),
    getComputedSplit(),
    getActivePhase(),
    getShoppingItems(),
    getWeekMealPlan(),
    getDraftMealPlan(),
    listRecipes(),
    getNotes(),
    getActiveProjectProgress(),
    getOpenTaskCount(),
  ]);
```
- An `<Dashboard ... />` zusätzlich übergeben:
```tsx
      meals={meals}
      draft={draft}
      recipes={recipes}
```

- [ ] **Step 4: Wire `dashboard.tsx`** — Props + Rendern des Panels.

In `src/components/dashboard.tsx`:
- Importe ergänzen:
```ts
import type { /* bestehende */ Meal, Note, DraftMeal, RecipeOption } from "@/lib/data";
import { MealDraftPanel } from "@/components/MealDraftPanel";
```
(Falls `Meal`/`Note` schon importiert sind, nur `DraftMeal`/`RecipeOption` ergänzen — passende vorhandene Importzeile erweitern.)
- `DashboardProps` erweitern:
```ts
  meals: Meal[];
  draft: DraftMeal[];
  recipes: RecipeOption[];
```
- In der Funktionssignatur destrukturieren: `meals, draft, recipes,` (zu den bestehenden hinzufügen).
- Direkt **nach** der `{/* WIDGET ROW */}`-`<section>` (nach deren schließendem `</section>`) eine bedingte Sektion einfügen:
```tsx
        {draft.length > 0 && (
          <section className="mt-4 sm:mt-5">
            <MealDraftPanel draft={draft} recipes={recipes} />
          </section>
        )}
```

- [ ] **Step 5: typecheck + lint + build**

Run: `npm run typecheck` → clean.
Run: `npm run lint` → clean (falls Lint etwas bemängelt, beheben — keine Regeln deaktivieren).
Run: `npm run build` → „Compiled successfully".

- [ ] **Step 6: Commit**

```bash
git add web/src/components/widgets.tsx web/src/components/MealDraftPanel.tsx web/src/components/dashboard.tsx web/src/app/page.tsx
git commit -m "feat: MealDraftPanel (Entwurf abnicken/aendern) + MealReasonBadge extrahiert"
```

---

## Task 10: Manuelle Verifikation im laufenden Dashboard

**Files:** keine (nur Beobachtung)

- [ ] **Step 1: Sicherstellen, dass dev.db einen aktiven Plan + Schichten hat**

Run: `npx tsx prisma/seed.ts`
Expected: „Seed completed." (aktiver Plan vorhanden; noch kein Entwurf).

- [ ] **Step 2: Dev-Server + Entwurf erzeugen**

Run: `npm run dev` (Port 3001). Im Dashboard „Woche neu planen" klicken.
Expected:
- Die Essensplan-**Kachel** zeigt weiterhin den **aktiven** (geseedeten) Plan.
- Darunter erscheint das **Entwurf-Panel** mit 5 Tagen.

- [ ] **Step 3: Ändern testen**
- „🎲" an einem Tag → das Gericht dieses Tages ändert sich (Badge/Constraint bleibt).
- Im `select` eines Tages ein anderes Rezept wählen → genau dieses Gericht steht dort.

- [ ] **Step 4: Abnicken testen**
- „Abnicken" → das Entwurf-Panel verschwindet, die **Kachel** zeigt jetzt den (eben abgenickten) Plan; die Bring-Pille zeigt das Ergebnis (oder den Kopier-Fallback, falls Bring nicht konfiguriert ist).
- „Woche neu planen" → Entwurf erneut; „Verwerfen" → Panel verschwindet, Kachel unverändert.

- [ ] **Step 5: dev.db zurücksetzen (sauberer Baseline-Zustand)**

Run: `npx tsx prisma/seed.ts`
Expected: „Seed completed."

---

## Self-Review (durch den Plan-Autor bereits erfolgt)

- **Spec-Abdeckung:** status-Modell (T1) · Entwurf erzeugen statt aktiv (T4) · Abnicken/Verwerfen (T5) · Tag neu würfeln/tauschen, dienstbewusst (T6, nutzt `constraintFromEntry` T2 + exportiertes `candidatesFor` T4) · Anzeige aktiv vs. Entwurf separat (T7 Repo + T9 UI) · Zutaten/Bring erst beim Abnicken, batch-fähig (T3 `planShoppingBatches` + T8 `approveDraftAction`) · syncIngredients ignoriert Entwurf (T7) · „einer reicht" (kein Per-Person-Status) · D-Naht dokumentiert (T3 + Spec).
- **Typen-Konsistenz:** `status` ("active"/"draft") überall gleich; `DayConstraint`/`MealReason` aus mealConstraints; `candidatesFor(c, base, preferSimple)`; `DraftMeal`/`RecipeOption` (data.ts) → Repo/Actions/UI; `ApprovePlanResult`/`BringPushResult` Action↔UI; `IngredientBatch.items: BringItem[]` ↔ `pushShoppingList`.
- **Bewusst außerhalb Scope:** Haltbarkeits-Batching (Schritt D), C2 (Push) / C3 (Auto-Auslöser), Per-Person-Freigabe.
