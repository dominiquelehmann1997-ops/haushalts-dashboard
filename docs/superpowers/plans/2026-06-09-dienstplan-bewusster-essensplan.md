# Dienstplan-bewusster Essensplan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Wochen-Essensplan ordnet Rezepte dienstplan-bewusst zu — einfaches Gericht an Domes Spätdienst-Tagen (Emely kocht allein), aufwärmbares Gericht mit Extraportion am Tag vor Spätdienst und am Nachtdienst-Tag.

**Architecture:** Reine Funktionen (`classifyShift`, `deriveDayConstraints`) leiten aus Domes Wochen-Schichten pro Tag Koch-Constraints ab; ein constraint-bewusster `generateWeekPlan` wählt passende Rezepte und persistiert je Eintrag Grund + Extraportion-Marker. DB/Next bleiben außen herum (Repository lädt Schichten, Server Action verdrahtet, Widget zeigt ein Badge) — exakt das etablierte „reiner Mapper + Unit-Test"-Muster (`shifts.ts` ↔ `repositories/calendar.ts`).

**Tech Stack:** TypeScript, Next.js (App Router, Server Actions), Prisma + SQLite (better-sqlite3 adapter), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-dienstplan-bewusster-essensplan-design.md`

**Working directory for all commands:** `web/` (alle Pfade unten sind relativ zu `web/`).

---

## File Structure

- **Create** `src/lib/services/mealConstraints.ts` — reine Constraint-Ableitung (`DayConstraint`, `deriveDayConstraints`).
- **Create** `src/lib/services/mealConstraints.test.ts` — Unit-Tests dafür.
- **Modify** `src/lib/calendar/shifts.ts` — neue reine `classifyShift` + `ShiftClass`.
- **Modify** `src/lib/calendar/shifts.test.ts` — Tests für `classifyShift`.
- **Modify** `src/lib/dates.ts` — `mondayOf` + `localDateKey` Helfer.
- **Modify** `prisma/schema.prisma` — `Recipe.reheatable`, `MealPlanEntry.reason` + `extraPortion`.
- **Modify** `prisma/seed.ts` — `reheatable`-Defaults der Bestandsrezepte.
- **Modify** `src/lib/services/mealPlanner.ts` — constraint-bewusste Auswahl + persistiert reason/extraPortion.
- **Modify** `src/lib/services/mealPlanner.test.ts` — Tests für constraint-bewusste Auswahl.
- **Modify** `src/lib/repositories/meals.ts` — `getDomeShiftsForWeek` + `reason`/`extraPortion` in `getWeekMealPlan`.
- **Modify** `src/lib/repositories/meals.test.ts` — Tests für `getDomeShiftsForWeek`.
- **Modify** `src/lib/data.ts` — `Meal` um `reason`/`extraPortion` erweitern.
- **Modify** `src/app/actions/meals.ts` — Schichten → Constraints → Planer verdrahten.
- **Modify** `src/components/widgets.tsx` — Badge je Tag.

---

## Task 1: `classifyShift` (reine Schicht-Klassifizierung)

**Files:**
- Modify: `src/lib/calendar/shifts.ts`
- Test: `src/lib/calendar/shifts.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/calendar/shifts.test.ts` den Import erweitern und einen neuen `describe`-Block ergänzen.

Import-Zeile (oben) ersetzen:

```ts
import { classifyShift, correctedBusyEnd, isOvernightShift } from "./shifts";
```

Am Dateiende anfügen:

```ts
describe("classifyShift", () => {
  it("classifies the exact shift titles, case- and whitespace-insensitive", () => {
    expect(classifyShift("Früh")).toBe("frueh");
    expect(classifyShift("Spät")).toBe("spaet");
    expect(classifyShift(" spät ")).toBe("spaet");
    expect(classifyShift("LT")).toBe("lt");
    expect(classifyShift("lt")).toBe("lt");
    expect(classifyShift("Nacht")).toBe("nacht");
    expect(classifyShift("LN")).toBe("nacht");
  });

  it("returns null for unknown titles and substring look-alikes (exact word match)", () => {
    expect(classifyShift("Nachtisch")).toBeNull();
    expect(classifyShift("Spätschicht")).toBeNull();
    expect(classifyShift("Sport")).toBeNull();
    expect(classifyShift("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calendar/shifts.test.ts`
Expected: FAIL — `classifyShift is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/calendar/shifts.ts` nach den bestehenden Konstanten/Funktionen anfügen (die vorhandenen `isOvernightShift`/`correctedBusyEnd` bleiben unverändert):

```ts
/** Domes Schicht-Klassen, abgeleitet aus dem exakten Kalender-Titel. */
export type ShiftClass = "frueh" | "spaet" | "lt" | "nacht";

/** Exakte Titel (lowercased) → Schicht-Klasse. */
const SHIFT_TITLES = new Map<string, ShiftClass>([
  ["früh", "frueh"],
  ["spät", "spaet"],
  ["lt", "lt"],
  ["nacht", "nacht"],
  ["ln", "nacht"],
]);

/**
 * Klassifiziert `title` zu einer `ShiftClass` — exakter, getrimmter,
 * case-insensitiver Voll-Match (wie `isOvernightShift`). Unbekannte oder
 * Teilstring-Titel ("Nachtisch", "Spätschicht") liefern `null`.
 */
export function classifyShift(title: string): ShiftClass | null {
  return SHIFT_TITLES.get(title.trim().toLowerCase()) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calendar/shifts.test.ts`
Expected: PASS (alle, inkl. der Bestandstests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/calendar/shifts.ts web/src/lib/calendar/shifts.test.ts
git commit -m "feat: classifyShift fuer Frueh/Spaet/LT/Nacht (reine Funktion)"
```

---

## Task 2: `deriveDayConstraints` + Date-Helfer

**Files:**
- Modify: `src/lib/dates.ts`
- Create: `src/lib/services/mealConstraints.ts`
- Test: `src/lib/services/mealConstraints.test.ts`

- [ ] **Step 1: Add the `mondayOf` date helper (no test of its own — covered via constraints)**

In `src/lib/dates.ts` nach `currentWeekBounds` anfügen:

```ts
/** Returns local midnight on the Monday of the ISO week containing `date`. */
export function mondayOf(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  const dayOfWeek = monday.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diffToMonday);
  return monday;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/services/mealConstraints.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { ShiftClass } from "@/lib/calendar/shifts";

import { deriveDayConstraints } from "./mealConstraints";

/** Builds a shiftByDay lookup from local-date → class for a Monday-based week. */
function lookupFrom(map: Record<string, ShiftClass>): (d: Date) => ShiftClass | null {
  return (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return map[key] ?? null;
  };
}

// Monday 2026-06-08 .. Saturday 2026-06-13 (month index 5 = June).
const MON = new Date(2026, 5, 8);

describe("deriveDayConstraints", () => {
  it("returns exactly Mon–Fri (5 entries) anchored to the week's Monday", () => {
    const result = deriveDayConstraints(MON, () => null);
    expect(result).toHaveLength(5);
    expect(result.map((c) => c.date.getDay())).toEqual([1, 2, 3, 4, 5]);
    expect(result.every((c) => c.reason === null && !c.extraPortion)).toBe(true);
  });

  it("Spätdienst-Tag → needsSimple + reason emely-allein", () => {
    const result = deriveDayConstraints(MON, lookupFrom({ "2026-6-10": "spaet" })); // Wed
    const wed = result[2];
    expect(wed.needsSimple).toBe(true);
    expect(wed.reason).toBe("emely-allein");
    expect(wed.needsReheatable).toBe(false);
  });

  it("Tag VOR Spätdienst → needsReheatable + extraPortion + reason aufwaermen-extra", () => {
    const result = deriveDayConstraints(MON, lookupFrom({ "2026-6-10": "spaet" })); // Wed
    const tue = result[1]; // Tag davor
    expect(tue.needsReheatable).toBe(true);
    expect(tue.extraPortion).toBe(true);
    expect(tue.reason).toBe("aufwaermen-extra");
    expect(tue.needsSimple).toBe(false);
  });

  it("Tag vor Spät am Freitag (Spät am Samstag, Lookahead) wird erkannt", () => {
    const result = deriveDayConstraints(MON, lookupFrom({ "2026-6-13": "spaet" })); // Sat
    const fri = result[4];
    expect(fri.needsReheatable).toBe(true);
    expect(fri.reason).toBe("aufwaermen-extra");
  });

  it("Nachtdienst-Tag → needsReheatable + extraPortion", () => {
    const result = deriveDayConstraints(MON, lookupFrom({ "2026-6-9": "nacht" })); // Tue
    const tue = result[1];
    expect(tue.needsReheatable).toBe(true);
    expect(tue.extraPortion).toBe(true);
    expect(tue.reason).toBe("aufwaermen-extra");
  });

  it("Konflikt (Spät an D und D+1): beide booleans gesetzt, reason priorisiert simple", () => {
    const result = deriveDayConstraints(
      MON,
      lookupFrom({ "2026-6-9": "spaet", "2026-6-10": "spaet" }), // Tue + Wed
    );
    const tue = result[1];
    expect(tue.needsSimple).toBe(true); // Spät an Tue
    expect(tue.needsReheatable).toBe(true); // Spät an Wed → Tue ist Tag-davor
    expect(tue.extraPortion).toBe(true);
    expect(tue.reason).toBe("emely-allein"); // Anzeige priorisiert simple
  });

  it("Früh und LT lösen keine Constraint aus", () => {
    const result = deriveDayConstraints(
      MON,
      lookupFrom({ "2026-6-8": "frueh", "2026-6-9": "lt" }),
    );
    expect(result[0].reason).toBeNull();
    expect(result[1].reason).toBeNull();
  });

  it("normalisiert einen beliebigen Wochentag auf den Montag der Woche", () => {
    const thursday = new Date(2026, 5, 11); // gleiche Woche wie MON
    const result = deriveDayConstraints(thursday, () => null);
    expect(result[0].date.getDate()).toBe(8); // Montag
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/services/mealConstraints.test.ts`
Expected: FAIL — Modul `./mealConstraints` existiert nicht.

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/services/mealConstraints.ts`:

```ts
// Reine Ableitung der dienstplan-bewussten Koch-Constraints je Wochentag.
//
// Eingabe: Domes Schicht-Klasse je lokalem Tag (via `shiftByDay`). Ausgabe:
// genau Mo–Fr der Woche, die `weekStart` enthält. Regeln (siehe Spec
// 2026-06-09): Spät an D → einfaches Gericht (Emely allein); Spät an D+1 oder
// Nacht an D → aufwärmbar + Extraportion. Pure (kein DB/Next/Prisma) — mirror
// des "reiner Mapper + Unit-Test"-Musters.

import type { ShiftClass } from "@/lib/calendar/shifts";
import { mondayOf } from "@/lib/dates";

export type MealReason = "emely-allein" | "aufwaermen-extra";

export interface DayConstraint {
  date: Date;
  needsSimple: boolean;
  needsReheatable: boolean;
  extraPortion: boolean;
  /** Anzeige-Verdichtung: priorisiert `emely-allein` über `aufwaermen-extra`. */
  reason: MealReason | null;
}

/** Returns a Date at `date + days`, local midnight preserved. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Leitet die Koch-Constraints für Mo–Fr der Woche um `weekStart` ab.
 * `shiftByDay(date)` liefert Domes Schicht-Klasse am lokalen Tag von `date`
 * (oder `null`). Für "Tag vor Spät" wird auch der Folgetag (bis Samstag)
 * abgefragt.
 */
export function deriveDayConstraints(
  weekStart: Date,
  shiftByDay: (date: Date) => ShiftClass | null,
): DayConstraint[] {
  const monday = mondayOf(weekStart);

  return [0, 1, 2, 3, 4].map((offset) => {
    const date = addDays(monday, offset);
    const today = shiftByDay(date);
    const tomorrow = shiftByDay(addDays(date, 1));

    const needsSimple = today === "spaet";
    const needsReheatable = tomorrow === "spaet" || today === "nacht";
    const extraPortion = needsReheatable;
    const reason: MealReason | null = needsSimple
      ? "emely-allein"
      : needsReheatable
        ? "aufwaermen-extra"
        : null;

    return { date, needsSimple, needsReheatable, extraPortion, reason };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/services/mealConstraints.test.ts`
Expected: PASS (alle 8).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/dates.ts web/src/lib/services/mealConstraints.ts web/src/lib/services/mealConstraints.test.ts
git commit -m "feat: deriveDayConstraints + mondayOf (reine Constraint-Ableitung)"
```

---

## Task 3: Schema-Migration (reheatable / reason / extraPortion) + Seed

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, `model Recipe` um ein Feld erweitern (nach `simple`):

```prisma
model Recipe {
  id         String  @id @default(cuid())
  name       String
  simple     Boolean @default(true)
  reheatable Boolean @default(false)
  tags       String? // JSON string array

  ingredients     Ingredient[]
  mealPlanEntries MealPlanEntry[]
}
```

`model MealPlanEntry` um zwei Felder erweitern:

```prisma
model MealPlanEntry {
  id           String   @id @default(cuid())
  date         DateTime
  reason       String? // "emely-allein" | "aufwaermen-extra" | null
  extraPortion Boolean  @default(false)

  recipeId String
  recipe   Recipe @relation(fields: [recipeId], references: [id])
}
```

- [ ] **Step 2: Create + apply the migration (also regenerates the Prisma client)**

Run: `node node_modules/prisma/build/index.js migrate dev --name dienstbewusster_essensplan`
Expected: Neue Migration unter `prisma/migrations/<timestamp>_dienstbewusster_essensplan/`, Client neu generiert nach `src/generated/prisma`, „Your database is now in sync".

- [ ] **Step 3: Seed reheatable defaults**

In `prisma/seed.ts` direkt nach der Zeile
`const simpleRecipes = new Set(["Pasta al Pomodoro", "Reste"]);`
einfügen:

```ts
  const reheatableRecipes = new Set(["Gemüse-Curry", "Ofengemüse", "Reste"]);
```

Und den Recipe-`create`-Aufruf (aktuell `data: { name, simple: simpleRecipes.has(name) }`) ersetzen durch:

```ts
    const recipe = await prisma.recipe.create({
      data: {
        name,
        simple: simpleRecipes.has(name),
        reheatable: reheatableRecipes.has(name),
      },
    });
```

- [ ] **Step 4: Re-seed the dev DB and verify columns exist**

Run: `npx tsx prisma/seed.ts`
Expected: „Seed completed." ohne Fehler.

Run: `node -e "const D=require('better-sqlite3');const db=new D('dev.db');console.log(db.prepare('SELECT name,simple,reheatable FROM Recipe ORDER BY name').all())"`
Expected: `Gemüse-Curry`/`Ofengemüse`/`Reste` mit `reheatable: 1`, `Pasta al Pomodoro`/`Pizzaabend` mit `reheatable: 0`.

- [ ] **Step 5: Run the full test suite (test DB picks up the migration via globalSetup)**

Run: `npm test`
Expected: PASS (Bestandstests laufen weiter; `globalSetup` wendet die neue Migration auf die Test-DB an).

- [ ] **Step 6: Commit**

```bash
git add web/prisma/schema.prisma web/prisma/migrations web/prisma/seed.ts web/src/generated
git commit -m "feat: Schema reheatable/reason/extraPortion + Seed-Defaults"
```

---

## Task 4: Constraint-bewusster `generateWeekPlan`

**Files:**
- Modify: `src/lib/services/mealPlanner.ts`
- Test: `src/lib/services/mealPlanner.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/services/mealPlanner.test.ts` einen neuen `describe`-Block am Dateiende anfügen (die Bestandstests bleiben unverändert — die neue `constraints`-Option ist optional). Import oben ergänzen:

```ts
import type { DayConstraint } from "./mealConstraints";
```

Am Dateiende:

```ts
describe("generateWeekPlan — dienstbewusst", () => {
  let cclient: PrismaClient;

  beforeEach(async () => {
    cclient ??= createTestClient();
    await resetDatabase(cclient);
  });

  afterAll(async () => {
    await cclient?.$disconnect();
  });

  /** Builds a 5-day (Mon–Fri) constraint array for the current week. */
  function constraintsForWeek(
    overrides: Partial<Record<0 | 1 | 2 | 3 | 4, Partial<DayConstraint>>>,
  ): DayConstraint[] {
    const { start } = (require("@/lib/dates") as typeof import("@/lib/dates")).currentWeekBounds();
    return [0, 1, 2, 3, 4].map((offset) => {
      const date = new Date(start);
      date.setDate(date.getDate() + offset);
      return {
        date,
        needsSimple: false,
        needsReheatable: false,
        extraPortion: false,
        reason: null,
        ...overrides[offset as 0 | 1 | 2 | 3 | 4],
      };
    });
  }

  const identityRng = () => 0.999;

  it("a needsSimple day gets a simple recipe and persists reason/extraPortion", async () => {
    const constraints = constraintsForWeek({
      0: { needsSimple: true, reason: "emely-allein" },
    });
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false, constraints },
      cclient,
      identityRng,
    );
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const monday = sorted[0];
    const recipe = await cclient.recipe.findUniqueOrThrow({ where: { id: monday.recipeId } });
    expect(recipe.simple).toBe(true);
    expect(monday.reason).toBe("emely-allein");
    expect(monday.extraPortion).toBe(false);
  });

  it("a needsReheatable day gets a reheatable recipe and extraPortion=true", async () => {
    const constraints = constraintsForWeek({
      1: { needsReheatable: true, extraPortion: true, reason: "aufwaermen-extra" },
    });
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false, constraints },
      cclient,
      identityRng,
    );
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const tuesday = sorted[1];
    const recipe = await cclient.recipe.findUniqueOrThrow({ where: { id: tuesday.recipeId } });
    expect(recipe.reheatable).toBe(true);
    expect(tuesday.extraPortion).toBe(true);
    expect(tuesday.reason).toBe("aufwaermen-extra");
  });

  it("conflict day (needsSimple+needsReheatable) prefers a recipe that is both (Reste)", async () => {
    // Seed-Daten: nur "Reste" ist simple && reheatable.
    const constraints = constraintsForWeek({
      2: {
        needsSimple: true,
        needsReheatable: true,
        extraPortion: true,
        reason: "emely-allein",
      },
    });
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false, constraints },
      cclient,
      identityRng,
    );
    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const wed = sorted[2];
    const recipe = await cclient.recipe.findUniqueOrThrow({ where: { id: wed.recipeId } });
    expect(recipe.simple && recipe.reheatable).toBe(true);
    expect(recipe.name).toBe("Reste");
  });

  it("without constraints behaves like before: 5 entries, all reason null", async () => {
    const entries = await generateWeekPlan(
      new Date(),
      { preferSimple: false },
      cclient,
      identityRng,
    );
    expect(entries).toHaveLength(5);
    expect(entries.every((e) => e.reason === null && !e.extraPortion)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/mealPlanner.test.ts`
Expected: FAIL — `constraints` wird nicht ausgewertet / `reason`/`extraPortion` nicht persistiert (TS-Fehler bei `opts.constraints`).

- [ ] **Step 3: Write the implementation**

`src/lib/services/mealPlanner.ts` ersetzen ab der `GenerateWeekPlanOptions`-Definition bis Dateiende. Imports oben um den Constraint-Typ ergänzen und `Recipe` importieren:

```ts
import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { MealPlanEntry, Recipe } from "@/generated/prisma/client";
import type { DayConstraint } from "@/lib/services/mealConstraints";
```

`GenerateWeekPlanOptions` ersetzen:

```ts
export interface GenerateWeekPlanOptions {
  /** When `true`, recipes flagged `simple` are preferred on unconstrained days. */
  preferSimple: boolean;
  /**
   * Per-weekday (Mon–Fri) cooking constraints derived from Dome's shifts.
   * When omitted, every day is treated as unconstrained (no reason / no extra).
   */
  constraints?: DayConstraint[];
}
```

`shuffle`, `addDays`, `weekBoundsOf` bleiben. Eine `noConstraint`-Fabrik und einen Pool-Selektor ergänzen (vor `generateWeekPlan`):

```ts
/** A constraint with no requirements, for days/weeks without shift data. */
function noConstraint(date: Date): DayConstraint {
  return {
    date,
    needsSimple: false,
    needsReheatable: false,
    extraPortion: false,
    reason: null,
  };
}

/**
 * Ordered candidate pool for one day, derived from the (already shuffled, and
 * for `preferSimple` simple-first) `base` list. Filters by the day's
 * constraints with the conflict priority from the spec; falls back to `base`
 * whenever a filtered pool would be empty so a recipe can always be chosen.
 */
function candidatesFor(
  c: DayConstraint,
  base: Recipe[],
  preferSimple: boolean,
): Recipe[] {
  let pool: Recipe[];
  if (c.needsSimple && c.needsReheatable) {
    const both = base.filter((r) => r.simple && r.reheatable);
    pool = both.length > 0 ? both : base.filter((r) => r.simple); // simple has priority
  } else if (c.needsSimple) {
    pool = base.filter((r) => r.simple);
  } else if (c.needsReheatable) {
    pool = base.filter((r) => r.reheatable);
  } else {
    pool = preferSimple ? base.filter((r) => r.simple) : base;
  }
  return pool.length > 0 ? pool : base;
}
```

`generateWeekPlan` ersetzen:

```ts
/**
 * Generates (and persists) the Mon–Fr meal plan for the week containing
 * `weekStart`, replacing any existing entries for that week.
 *
 * For each weekday the recipe is chosen from a candidate pool that satisfies
 * that day's shift constraints (`opts.constraints`, Mon–Fri; defaults to
 * unconstrained). `preferSimple` biases unconstrained days toward simple
 * recipes. Within the pool, the first not-yet-used recipe wins (variety);
 * `rng` shuffles the base order so re-generating yields a fresh plan — and
 * keeps tests deterministic when injected. Each entry persists the day's
 * `reason` and `extraPortion` marker.
 */
export async function generateWeekPlan(
  weekStart: Date,
  opts: GenerateWeekPlanOptions,
  client: PrismaClient = prisma,
  rng: () => number = Math.random,
): Promise<MealPlanEntry[]> {
  const { start: monday, end: sunday } = weekBoundsOf(weekStart);

  const recipes = await client.recipe.findMany({ orderBy: { name: "asc" } });
  if (recipes.length === 0) return [];

  // Freshness: shuffle once; for preferSimple, stable-sort simple recipes first.
  let base = shuffle(recipes, rng);
  if (opts.preferSimple) {
    base = [...base].sort((a, b) => (a.simple === b.simple ? 0 : a.simple ? -1 : 1));
  }

  const weekdayDates = [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
  const constraints = weekdayDates.map(
    (date, i) => opts.constraints?.[i] ?? noConstraint(date),
  );

  // Replace: wipe this week's plan, then (re-)create the 5 entries.
  await client.mealPlanEntry.deleteMany({ where: { date: { gte: monday, lte: sunday } } });

  const used = new Set<string>();
  const created: MealPlanEntry[] = [];
  for (let i = 0; i < weekdayDates.length; i++) {
    const c = constraints[i];
    const pool = candidatesFor(c, base, opts.preferSimple);
    const fresh = pool.filter((r) => !used.has(r.id));
    const pick = (fresh.length > 0 ? fresh : pool)[0];
    used.add(pick.id);

    const entry = await client.mealPlanEntry.create({
      data: {
        date: weekdayDates[i],
        recipeId: pick.id,
        reason: c.reason,
        extraPortion: c.extraPortion,
      },
    });
    created.push(entry);
  }

  return created;
}
```

- [ ] **Step 4: Run the planner tests**

Run: `npx vitest run src/lib/services/mealPlanner.test.ts`
Expected: PASS — neue dienstbewusste Tests **und** die Bestandstests (Identity-rng pinnt die Reihenfolge wie zuvor; ohne Constraints volle Abdeckung mit 5 Rezepten).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/mealPlanner.ts web/src/lib/services/mealPlanner.test.ts
git commit -m "feat: constraint-bewusste Rezeptauswahl in generateWeekPlan"
```

---

## Task 5: `getDomeShiftsForWeek` Repository + `localDateKey`

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/lib/repositories/meals.ts`
- Test: `src/lib/repositories/meals.test.ts`

- [ ] **Step 1: Add the `localDateKey` helper**

In `src/lib/dates.ts` anfügen:

```ts
/** Stable local-day key "YYYY-M-D" (no padding) for map lookups by calendar day. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
```

- [ ] **Step 2: Write the failing test**

In `src/lib/repositories/meals.test.ts` Imports erweitern und einen `describe`-Block ergänzen.

Imports oben ersetzen/ergänzen:

```ts
import { getDomeShiftsForWeek, getWeekMealPlan } from "./meals";
import { currentWeekBounds, localDateKey } from "@/lib/dates";
```

Am Dateiende:

```ts
describe("getDomeShiftsForWeek", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  /** Creates a dome calendar event on `date` with `title`. */
  async function domeEvent(date: Date, title: string) {
    const start = new Date(date);
    start.setHours(21, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 0, 0);
    await client.calendarEvent.create({
      data: {
        externalId: `shift-${title}-${date.getTime()}`,
        calendarKey: "dome",
        title,
        start,
        end,
        personKey: "dome",
        kind: "termin",
      },
    });
  }

  it("classifies Dome's Mon–Sat shifts into a date→class map", async () => {
    const { start: monday } = currentWeekBounds();
    const tue = new Date(monday);
    tue.setDate(tue.getDate() + 1);
    const sat = new Date(monday);
    sat.setDate(sat.getDate() + 5);

    await domeEvent(tue, "Spät");
    await domeEvent(sat, "Nacht");

    const map = await getDomeShiftsForWeek(monday, client);

    expect(map.get(localDateKey(tue))).toBe("spaet");
    expect(map.get(localDateKey(sat))).toBe("nacht"); // Samstag-Lookahead enthalten
  });

  it("ignores non-shift titles and other persons", async () => {
    const { start: monday } = currentWeekBounds();
    const wed = new Date(monday);
    wed.setDate(wed.getDate() + 2);
    await domeEvent(wed, "Sport"); // kein Schicht-Titel

    const map = await getDomeShiftsForWeek(monday, client);
    expect(map.get(localDateKey(wed))).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/repositories/meals.test.ts`
Expected: FAIL — `getDomeShiftsForWeek` nicht exportiert.

- [ ] **Step 4: Write the implementation**

In `src/lib/repositories/meals.ts` Imports erweitern:

```ts
import { currentWeekBounds, localDateKey, mondayOf } from "@/lib/dates";
import { classifyShift, type ShiftClass } from "@/lib/calendar/shifts";
```

(Die bestehende `import { currentWeekBounds } from "@/lib/dates";`-Zeile durch die obige ersetzen.)

Am Dateiende anfügen:

```ts
/**
 * Dome's shift class per local day for Mon–Sat of the week containing
 * `weekStart`, keyed by `localDateKey`. Saturday is included as a lookahead so
 * "day before Spätdienst" can be detected for Friday. Only `personKey: "dome"`
 * events whose title classifies to a `ShiftClass` are kept.
 */
export async function getDomeShiftsForWeek(
  weekStart: Date,
  client: PrismaClient = prisma,
): Promise<Map<string, ShiftClass>> {
  const monday = mondayOf(weekStart);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6); // upper bound exclusive-ish; Sat covered

  const rows = await client.calendarEvent.findMany({
    where: { personKey: "dome", start: { gte: monday, lt: sunday } },
    orderBy: { start: "asc" },
  });

  const map = new Map<string, ShiftClass>();
  for (const row of rows) {
    const shift = classifyShift(row.title);
    if (shift) map.set(localDateKey(row.start), shift);
  }
  return map;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/repositories/meals.test.ts`
Expected: PASS (neue + Bestandstest).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/dates.ts web/src/lib/repositories/meals.ts web/src/lib/repositories/meals.test.ts
git commit -m "feat: getDomeShiftsForWeek + localDateKey"
```

---

## Task 6: Verdrahtung (Action) + Anzeige (Domain + Widget)

**Files:**
- Modify: `src/lib/data.ts`
- Modify: `src/lib/repositories/meals.ts`
- Modify: `src/app/actions/meals.ts`
- Modify: `src/components/widgets.tsx`
- Test: `src/lib/repositories/meals.test.ts`

- [ ] **Step 1: Extend the `Meal` DTO**

In `src/lib/data.ts` das `Meal`-Interface erweitern:

```ts
export interface Meal {
  day: string;
  dish: string;
  today: boolean;
  light?: boolean;
  /** Shift-aware hint: "emely-allein" | "aufwaermen-extra" | null. */
  reason?: string | null;
  /** True when an extra portion is planned (Dome takes leftovers to work). */
  extraPortion?: boolean;
}
```

- [ ] **Step 2: Write the failing test (getWeekMealPlan surfaces reason/extraPortion)**

In `src/lib/repositories/meals.test.ts` im bestehenden `describe("meals repository", ...)` einen Test anfügen:

```ts
  it("getWeekMealPlan surfaces reason/extraPortion from the entry", async () => {
    const { start } = (await import("@/lib/dates")).currentWeekBounds();
    const monday = new Date(start);

    const entry = await client.mealPlanEntry.findFirstOrThrow({
      where: { date: { gte: monday } },
      orderBy: { date: "asc" },
    });
    await client.mealPlanEntry.update({
      where: { id: entry.id },
      data: { reason: "emely-allein", extraPortion: true },
    });

    const plan = await getWeekMealPlan(client);
    const mondayMeal = plan.find((m) => m.day === "Mo");
    expect(mondayMeal?.reason).toBe("emely-allein");
    expect(mondayMeal?.extraPortion).toBe(true);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/repositories/meals.test.ts`
Expected: FAIL — `reason`/`extraPortion` werden vom Mapper noch nicht durchgereicht (`undefined`).

- [ ] **Step 4: Map the fields in `getWeekMealPlan`**

In `src/lib/repositories/meals.ts` den `return rows.map(...)` in `getWeekMealPlan` ersetzen:

```ts
  return rows.map((row) => ({
    day: WEEKDAY_LABELS[row.date.getDay()],
    dish: row.recipe.name,
    today: isToday(row.date),
    reason: row.reason,
    extraPortion: row.extraPortion,
  }));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/repositories/meals.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire the Server Action**

In `src/app/actions/meals.ts` die Imports erweitern:

```ts
import { generateWeekPlan } from "@/lib/services/mealPlanner";
import { deriveDayConstraints } from "@/lib/services/mealConstraints";
import { syncIngredientsToShopping } from "@/lib/services/shoppingSync";
import { getActivePhase } from "@/lib/repositories/phase";
import { getDomeShiftsForWeek } from "@/lib/repositories/meals";
import { localDateKey } from "@/lib/dates";
import { pushShoppingList, type BringPushResult } from "@/integrations/bring/client";
```

Den Body von `generatePlanAction` (die `generateWeekPlan`-Zeile) ersetzen:

```ts
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
  const ingredients = await syncIngredientsToShopping();
```

- [ ] **Step 7: Render the badge in the widget**

In `src/components/widgets.tsx` innerhalb von `MealPlanWidget`, im `<li>` direkt **nach** dem `{m.dish}`-`<span>` (und vor dem `{m.today && ...}`-Block) einfügen:

```tsx
            {m.reason && (
              <span
                className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                  m.reason === "emely-allein"
                    ? "bg-emely-tint text-emely-deep dark:bg-emely/15 dark:text-emely"
                    : "bg-cream text-ink-soft dark:bg-white/10 dark:text-cream/70"
                }`}
                title={
                  m.reason === "emely-allein"
                    ? "Spätdienst Dome — Emely kocht allein"
                    : "Aufwärmbar + Extraportion für Dome"
                }
              >
                {m.reason === "emely-allein"
                  ? "Emely allein"
                  : m.extraPortion
                    ? "Aufwärmen · +Portion"
                    : "Aufwärmen"}
              </span>
            )}
```

- [ ] **Step 8: Typecheck, lint, full test run**

Run: `npm run typecheck`
Expected: keine Fehler.

Run: `npm run lint`
Expected: keine Fehler.

Run: `npm test`
Expected: PASS (gesamte Suite).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/data.ts web/src/lib/repositories/meals.ts web/src/lib/repositories/meals.test.ts web/src/app/actions/meals.ts web/src/components/widgets.tsx
git commit -m "feat: dienstbewusster Essensplan verdrahtet + Badge in der Kachel"
```

---

## Task 7: Manuelle Verifikation im laufenden Dashboard

**Files:** keine (nur Beobachtung)

- [ ] **Step 1: Seed dev DB mit einer Spät-Schicht für Dome (zur sichtbaren Prüfung)**

Run:
```bash
node -e "const D=require('better-sqlite3');const db=new D('dev.db');const now=new Date();const day=now.getDay();const diff=day===0?-6:1-day;const mon=new Date(now);mon.setHours(21,0,0,0);mon.setDate(mon.getDate()+diff+1);const end=new Date(mon);end.setHours(23,59,0,0);db.prepare(\"INSERT INTO CalendarEvent (id,externalId,calendarKey,title,start,end,personKey,kind,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)\").run('vrf1','vrf-spaet','dome','Spät',mon.toISOString(),end.toISOString(),'dome','termin',new Date().toISOString());console.log('Spät am',mon.toISOString())"
```
Expected: Gibt das Spät-Datum (Dienstag dieser Woche) aus.

- [ ] **Step 2: Dev-Server starten und Plan neu erzeugen**

Run: `npm run dev` (Port 3001) — im Dashboard den „Essensplan neu erzeugen"-Button (MealPlanControl) klicken.

Expected (visuell):
- **Dienstag** zeigt das Badge **„Emely allein"** und ein einfaches Rezept.
- **Montag** (Tag vor Spät) zeigt **„Aufwärmen · +Portion"** und ein aufwärmbares Rezept.

- [ ] **Step 3: Verifikations-Event wieder entfernen**

Run:
```bash
node -e "const D=require('better-sqlite3');const db=new D('dev.db');db.prepare(\"DELETE FROM CalendarEvent WHERE externalId='vrf-spaet'\").run();console.log('removed')"
```
Expected: `removed`.

---

## Self-Review (durch den Plan-Autor bereits erfolgt)

- **Spec-Abdeckung:** Schicht-Erkennung (Task 1) · Constraints inkl. Tag-vor-Spät + Nacht + Konflikt (Task 2) · Schema reheatable/reason/extraPortion + Seed (Task 3) · constraint-bewusste Auswahl mit Konflikt-Priorität + Fallback (Task 4) · `getDomeShiftsForWeek` Mo–Sa (Task 5) · Verdrahtung + Anzeige (Task 6) · „Extraportion = nur Marker" eingehalten (kein Eingriff in `syncIngredientsToShopping`).
- **Typen-Konsistenz:** `ShiftClass` (shifts.ts) → `deriveDayConstraints`/`getDomeShiftsForWeek`; `DayConstraint` (mealConstraints.ts) → `generateWeekPlan`; `reason`/`extraPortion` durchgängig gleich benannt (Schema ↔ DTO ↔ Widget).
- **Bewusst außerhalb Scope:** Einkaufsmengen/Haltbarkeit (Roadmap D), Push/Freigabe (Roadmap C), `Früh`/`LT`-Regeln.
