# Tablet-Betrieb + Chore-Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Haushalts-Dashboard läuft lokal auf dem Pixel Tablet (Termux + PWA) und enthält die 17 echten Haushalts-Chores mit korrekten Intervallen.

**Architecture:** Reine Logik in pure Funktionen (`recurrence`, `chores`), DB-Schreiben in einer Repository-Funktion (`choreImport`), CLI-Wrapper unter `prisma/` analog zum bestehenden Seed. PWA per Web-Manifest + Next-Metadata, kein Service-Worker. Betrieb am Tablet per Termux-Runbook (Doku + Start-Skript). Keine DB-Migration nötig (`Task.rhythm` ist bereits `String?`).

**Tech Stack:** Next.js 16, Prisma 7 (better-sqlite3 Driver-Adapter), SQLite, Vitest 4, tsx, Termux (Android).

**Spec:** [docs/superpowers/specs/2026-06-12-tablet-betrieb-chore-import-design.md](../specs/2026-06-12-tablet-betrieb-chore-import-design.md)

**Konventionen aus dem Repo:**
- Tests via `npm test` (= `vitest run`), Einzeltest `npx vitest run <pfad>`. tsx + Vitest lösen den `@/`-Alias auf.
- Nach `prisma migrate` immer `node node_modules/prisma/build/index.js generate` — hier aber keine Migration nötig.
- Pure Funktionen ohne DB-Abhängigkeit, Repositories nehmen einen `client`-Parameter (testbar gegen Test-DB via `@/test/db`).
- Commits: Conventional Commits, deutsche Beschreibung, Footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Task 1: Recurrence-Engine um neue Rhythmen erweitern

Neue Rhythmen `3-day`, `5-day` (Tages-Offset) und `monthly`, `halfyearly` (Kalendermonat). Bestehendes Verhalten (`daily/weekly/biweekly/2x-week`, unknown→+7) bleibt unverändert.

**Files:**
- Modify: `web/src/lib/services/recurrence.ts`
- Test: `web/src/lib/services/recurrence.test.ts`

- [ ] **Step 1: Failing-Tests ergänzen**

In `web/src/lib/services/recurrence.test.ts`, innerhalb des `describe("nextDueDate (pure)", ...)`-Blocks (nach dem `2x-week`-Test, vor dem `unknown rhythm`-Test) einfügen:

```ts
  it("3-day -> +3 days", () => {
    const result = nextDueDate("3-day", from);
    expect(result.getTime() - from.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("5-day -> +5 days", () => {
    const result = nextDueDate("5-day", from);
    expect(result.getTime() - from.getTime()).toBe(5 * 24 * 60 * 60 * 1000);
  });

  it("monthly -> +1 calendar month (same day-of-month)", () => {
    const result = nextDueDate("monthly", new Date(2026, 5, 12)); // 12 Jun 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6); // Jul
    expect(result.getDate()).toBe(12);
  });

  it("halfyearly -> +6 calendar months across the year boundary", () => {
    const result = nextDueDate("halfyearly", new Date(2026, 7, 12)); // 12 Aug 2026
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(12);
  });
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/lib/services/recurrence.test.ts` (aus `web/`)
Expected: FAIL — `monthly`/`halfyearly` liefern aktuell +7 Tage statt Kalendermonat; `3-day`/`5-day` fallen auf +7 zurück.

- [ ] **Step 3: `recurrence.ts` erweitern**

In `web/src/lib/services/recurrence.ts` die Offset-Map ergänzen und eine Monats-Map plus Monats-Zweig in `nextDueDate` hinzufügen. Die Map `RHYTHM_OFFSET_DAYS` und die Funktion `nextDueDate` so ersetzen:

```ts
/** Per-rhythm offsets in days. Unknown rhythms default to weekly (+7 days). */
const RHYTHM_OFFSET_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  "2x-week": 3,
  "3-day": 3,
  "5-day": 5,
};

/** Rhythms advanced by whole calendar months (no day-count drift). */
const RHYTHM_MONTHS: Record<string, number> = {
  monthly: 1,
  halfyearly: 6,
};

const DEFAULT_OFFSET_DAYS = 7;

/**
 * Returns a *new* `Date` advanced from `from` by the offset for `rhythm`.
 * Day-based rhythms (`daily`/`weekly`/`biweekly`/`2x-week`/`3-day`/`5-day`)
 * add a fixed number of days; month-based rhythms (`monthly`/`halfyearly`)
 * advance whole calendar months via `setMonth` (so 12th -> 12th, no drift).
 * Unknown/unsupported rhythms default to +7 days (weekly).
 *
 * Note: `setMonth` rolls over for shorter months (31 Jan + 1 month -> 3 Mar);
 * acceptable for household chores.
 *
 * Pure — does not mutate `from`, has no DB dependency.
 */
export function nextDueDate(rhythm: string, from: Date): Date {
  const months = RHYTHM_MONTHS[rhythm];
  if (months !== undefined) {
    const result = new Date(from);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  const offsetDays = RHYTHM_OFFSET_DAYS[rhythm] ?? DEFAULT_OFFSET_DAYS;
  return new Date(from.getTime() + offsetDays * DAY_MS);
}
```

(Die JSDoc über der bestehenden Funktion mit ersetzen; `DAY_MS` bleibt oben unverändert.)

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/lib/services/recurrence.test.ts` (aus `web/`)
Expected: PASS (alle, inkl. unveränderter `2x-week`- und `unknown`-Test).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/recurrence.ts web/src/lib/services/recurrence.test.ts
git commit -m "feat: Recurrence kennt 3-day/5-day/monthly/halfyearly

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Chore-Definitionen + Mapping (pure)

Statische Liste der 17 Chores + pure Funktion `buildChoreTasks(today)`, die gestaffelte Fälligkeiten berechnet. Keine DB.

**Files:**
- Create: `web/src/lib/services/chores.ts`
- Test: `web/src/lib/services/chores.test.ts`

- [ ] **Step 1: Failing-Test schreiben**

Create `web/src/lib/services/chores.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildChoreTasks, CHORES } from "./chores";

const today = new Date(2026, 5, 12); // 12 Jun 2026, local midnight

describe("CHORES", () => {
  it("contains 17 chores", () => {
    expect(CHORES).toHaveLength(17);
  });

  it("Rasen mähen is Dome-only, outdoor, noRain", () => {
    const rasen = CHORES.find((c) => c.title === "Rasen mähen");
    expect(rasen?.allowedPersons).toBe("dome");
    expect(rasen?.outdoor).toBe(true);
    expect(rasen?.weatherCondition).toBe('{"noRain":true}');
  });

  it("Gassi gehen is outdoor but has no weather condition", () => {
    const gassi = CHORES.find((c) => c.title === "Gassi gehen");
    expect(gassi?.outdoor).toBe(true);
    expect(gassi?.weatherCondition).toBeNull();
  });

  it("shopping chores have no rhythm", () => {
    const einkauf = CHORES.find((c) => c.title === "Einkaufen");
    const futter = CHORES.find((c) => c.title === "Hundefutter kaufen");
    expect(einkauf?.type).toBe("shopping");
    expect(einkauf?.rhythm).toBeNull();
    expect(futter?.type).toBe("shopping");
    expect(futter?.rhythm).toBeNull();
  });

  it("every non-shopping chore has a rhythm", () => {
    for (const chore of CHORES) {
      if (chore.type !== "shopping") {
        expect(chore.rhythm, chore.title).not.toBeNull();
      }
    }
  });
});

describe("buildChoreTasks", () => {
  it("returns one task per chore with a dueDate", () => {
    const tasks = buildChoreTasks(today);
    expect(tasks).toHaveLength(17);
    for (const task of tasks) {
      expect(task.dueDate instanceof Date).toBe(true);
    }
  });

  it("staggers Bad groß and Bad klein onto different days", () => {
    const tasks = buildChoreTasks(today);
    const gross = tasks.find((t) => t.title === "Bad putzen (groß)");
    const klein = tasks.find((t) => t.title === "Bad putzen (klein)");
    expect(gross?.dueDate.getTime()).not.toBe(klein?.dueDate.getTime());
  });

  it("does not mutate the input date", () => {
    const original = new Date(today);
    buildChoreTasks(today);
    expect(today.getTime()).toBe(original.getTime());
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/services/chores.test.ts` (aus `web/`)
Expected: FAIL — `chores.ts` existiert nicht.

- [ ] **Step 3: `chores.ts` implementieren**

Create `web/src/lib/services/chores.ts`:

```ts
// Static household-chore catalogue + a pure mapping to Task-creation data.
// Source of truth: docs/superpowers/specs/2026-06-12-tablet-betrieb-chore-import-design.md
// No DB access here — `buildChoreTasks` is pure and deterministic.

export type ChoreInput = {
  title: string;
  type: "routine" | "shopping";
  rhythm: string | null; // null = no auto-recurrence (shopping)
  effort: number; // minutes
  allowedPersons: "both" | "dome" | "emely";
  outdoor: boolean;
  weatherCondition: string | null; // JSON string e.g. '{"noRain":true}'
  icon: string;
  note: string | null;
  sub: string | null;
};

export type ChoreTaskData = ChoreInput & { dueDate: Date };

const NO_RAIN = '{"noRain":true}';

/** The 17 real household chores (Spec 2026-06-12). Order defines the stagger. */
export const CHORES: ChoreInput[] = [
  { title: "Saugroboter starten", type: "routine", rhythm: "daily", effort: 2, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🤖", note: null, sub: null },
  { title: "Bad putzen (groß)", type: "routine", rhythm: "weekly", effort: 30, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🛁", note: null, sub: "groß" },
  { title: "Bad putzen (klein)", type: "routine", rhythm: "weekly", effort: 15, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🚽", note: null, sub: "klein" },
  { title: "Treppe saugen", type: "routine", rhythm: "3-day", effort: 5, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🧹", note: null, sub: null },
  { title: "Rasen mähen", type: "routine", rhythm: "weekly", effort: 60, allowedPersons: "dome", outdoor: true, weatherCondition: NO_RAIN, icon: "🌱", note: null, sub: "nur Dome · Outdoor" },
  { title: "Wäsche waschen", type: "routine", rhythm: "5-day", effort: 20, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🧺", note: "alle 5 Tage kontrollieren", sub: null },
  { title: "Küchenfronten putzen", type: "routine", rhythm: "monthly", effort: 30, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🧽", note: null, sub: null },
  { title: "Sofa und Teppich absaugen", type: "routine", rhythm: "3-day", effort: 10, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🛋️", note: null, sub: null },
  { title: "Staub wischen", type: "routine", rhythm: "weekly", effort: 20, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🪶", note: null, sub: null },
  { title: "Monty bürsten", type: "routine", rhythm: "weekly", effort: 15, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🐕", note: null, sub: null },
  { title: "Gassi gehen", type: "routine", rhythm: "daily", effort: 45, allowedPersons: "both", outdoor: true, weatherCondition: null, icon: "🦮", note: "möglichst vor Spätdienst", sub: null },
  { title: "Einkaufen", type: "shopping", rhythm: null, effort: 50, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🛒", note: "nach Bedarf", sub: null },
  { title: "Hundefutter kaufen", type: "shopping", rhythm: null, effort: 5, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🦴", note: "nach Verbrauch (Vorrats-Rechner später)", sub: null },
  { title: "Kühlschrank ausmisten und wischen", type: "routine", rhythm: "monthly", effort: 60, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🧊", note: null, sub: null },
  { title: "Altglas wegbringen", type: "routine", rhythm: "biweekly", effort: 10, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "♻️", note: null, sub: null },
  { title: "Pfand wegbringen", type: "routine", rhythm: "biweekly", effort: 1, allowedPersons: "both", outdoor: false, weatherCondition: null, icon: "🥤", note: "mit Einkauf verbinden", sub: null },
  { title: "Fenster putzen", type: "routine", rhythm: "halfyearly", effort: 90, allowedPersons: "both", outdoor: true, weatherCondition: NO_RAIN, icon: "🪟", note: "oben + unten aufteilen, je ≥1,5h/Geschoss", sub: null },
];

/** Returns a *new* Date at `date + days`, preserving the time-of-day. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Spread window (days) used to stagger initial due dates so not every chore
 * is due on day one. Short rhythms keep their own window; weekly and longer
 * (incl. month rhythms) spread over a week; no-rhythm chores are due today.
 */
function staggerWindow(rhythm: string | null): number {
  switch (rhythm) {
    case null:
      return 1; // index % 1 === 0 -> due today
    case "daily":
      return 1;
    case "3-day":
      return 3;
    case "5-day":
      return 5;
    default:
      return 7; // weekly, biweekly, monthly, halfyearly
  }
}

/**
 * Maps the static `CHORES` to Task-creation data with deterministically
 * staggered `dueDate`s anchored at `today`. Pure — no mutation, no DB.
 * `dueDate = today + (index % staggerWindow(rhythm))`.
 */
export function buildChoreTasks(today: Date): ChoreTaskData[] {
  return CHORES.map((chore, index) => ({
    ...chore,
    dueDate: addDays(today, index % staggerWindow(chore.rhythm)),
  }));
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/lib/services/chores.test.ts` (aus `web/`)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/chores.ts web/src/lib/services/chores.test.ts
git commit -m "feat: Chore-Katalog + pure buildChoreTasks (17 Aufgaben)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Import-Repository (idempotenter Upsert nach Titel)

DB-Funktion, die Personen sicherstellt und jede Chore per Titel anlegt oder aktualisiert. Aktualisiert nur Definitions-Felder — `dueDate`/`status`/`assignedToId` bleiben bei bestehenden Tasks erhalten (kein Reset des Live-Zustands).

**Files:**
- Create: `web/src/lib/repositories/choreImport.ts`
- Test: `web/src/lib/repositories/choreImport.test.ts`

- [ ] **Step 1: Failing-Test schreiben**

Create `web/src/lib/repositories/choreImport.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { importChores } from "./choreImport";
import { CHORES } from "@/lib/services/chores";

const today = new Date(2026, 5, 12);

describe("importChores", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("creates exactly one task per chore title", async () => {
    await importChores(client, today);

    for (const chore of CHORES) {
      const count = await client.task.count({ where: { title: chore.title } });
      expect(count, chore.title).toBe(1);
    }
  });

  it("sets Rasen mähen to Dome-only", async () => {
    await importChores(client, today);

    const rasen = await client.task.findFirst({ where: { title: "Rasen mähen" } });
    expect(rasen?.allowedPersons).toBe("dome");
    expect(rasen?.outdoor).toBe(true);
    expect(rasen?.weatherCondition).toBe('{"noRain":true}');
  });

  it("is idempotent: a second run creates no duplicates", async () => {
    await importChores(client, today);
    const after1 = await client.task.count();

    await importChores(client, today);
    const after2 = await client.task.count();

    expect(after2).toBe(after1);
    for (const chore of CHORES) {
      const count = await client.task.count({ where: { title: chore.title } });
      expect(count, chore.title).toBe(1);
    }
  });

  it("preserves an existing task's dueDate and status on re-import", async () => {
    await importChores(client, today);
    const before = await client.task.findFirstOrThrow({ where: { title: "Staub wischen" } });
    await client.task.update({
      where: { id: before.id },
      data: { status: "done", dueDate: new Date(2026, 0, 1) },
    });

    await importChores(client, today);

    const after = await client.task.findFirstOrThrow({ where: { title: "Staub wischen" } });
    expect(after.status).toBe("done");
    expect(after.dueDate.getTime()).toBe(new Date(2026, 0, 1).getTime());
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/repositories/choreImport.test.ts` (aus `web/`)
Expected: FAIL — `choreImport.ts` existiert nicht.

- [ ] **Step 3: `choreImport.ts` implementieren**

Create `web/src/lib/repositories/choreImport.ts`:

```ts
import { PrismaClient } from "@/generated/prisma/client";

import { buildChoreTasks } from "@/lib/services/chores";

type Summary = { created: number; updated: number };

const PEOPLE = [
  { key: "dome", name: "Dome", role: "adult", colorAccent: "teal" },
  { key: "emely", name: "Emely", role: "adult", colorAccent: "coral" },
  { key: "baby", name: "Baby", role: "baby", colorAccent: "neutral" },
] as const;

/** Creates the three household members if they are missing (idempotent). */
async function ensurePeople(client: PrismaClient): Promise<void> {
  for (const person of PEOPLE) {
    const existing = await client.person.findFirst({ where: { key: person.key } });
    if (!existing) {
      await client.person.create({ data: { ...person } });
    }
  }
}

/**
 * Imports the static chore catalogue into the Task table, anchored at `today`.
 * Upserts by `Task.title` (which is not unique, so we match the first row):
 * - missing title  -> create (open, unassigned, staggered dueDate)
 * - existing title -> update definition fields only; dueDate/status/assignedToId
 *   are left untouched so live progress is preserved.
 * Idempotent and non-destructive (touches no other tasks/tables).
 */
export async function importChores(client: PrismaClient, today: Date): Promise<Summary> {
  await ensurePeople(client);

  const summary: Summary = { created: 0, updated: 0 };

  for (const chore of buildChoreTasks(today)) {
    const definition = {
      type: chore.type,
      rhythm: chore.rhythm,
      effort: chore.effort,
      allowedPersons: chore.allowedPersons,
      outdoor: chore.outdoor,
      weatherCondition: chore.weatherCondition,
      icon: chore.icon,
      note: chore.note,
      sub: chore.sub,
    };

    const existing = await client.task.findFirst({ where: { title: chore.title } });

    if (existing) {
      await client.task.update({ where: { id: existing.id }, data: definition });
      summary.updated += 1;
    } else {
      await client.task.create({
        data: {
          title: chore.title,
          ...definition,
          status: "open",
          assignedToId: null,
          dueDate: chore.dueDate,
        },
      });
      summary.created += 1;
    }
  }

  return summary;
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/lib/repositories/choreImport.test.ts` (aus `web/`)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/repositories/choreImport.ts web/src/lib/repositories/choreImport.test.ts
git commit -m "feat: idempotenter Chore-Import (Upsert nach Titel)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: CLI-Entrypoint + npm-Script

Standalone-Skript analog `prisma/seed.ts`, das einen eigenen PrismaClient (better-sqlite3-Adapter) öffnet und `importChores` gegen `dev.db` ausführt.

**Files:**
- Create: `web/prisma/importChores.ts`
- Modify: `web/package.json` (scripts)

- [ ] **Step 1: CLI-Skript schreiben**

Create `web/prisma/importChores.ts`:

```ts
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { importChores } from "../src/lib/repositories/choreImport";

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const summary = await importChores(prisma, today);
    console.log(`Chore-Import fertig: ${summary.created} neu, ${summary.updated} aktualisiert.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: npm-Script ergänzen**

In `web/package.json` im `"scripts"`-Block nach `"test:watch"` eine Zeile ergänzen (Komma nach `test:watch` nicht vergessen):

```json
    "test:watch": "vitest",
    "import:chores": "tsx prisma/importChores.ts"
```

- [ ] **Step 3: Skript gegen die Dev-DB ausführen**

Run (aus `web/`): `npm run import:chores`
Expected: Ausgabe `Chore-Import fertig: <n> neu, <m> aktualisiert.` ohne Fehler. (Auf einer frischen DB: 17 neu bzw. 16 neu + 1 aktualisiert, falls der Demo-Seed bereits „Rasen mähen" angelegt hatte.)

- [ ] **Step 4: Idempotenz manuell prüfen**

Run (aus `web/`): `npm run import:chores`
Expected: `0 neu, 17 aktualisiert.`

- [ ] **Step 5: Commit**

```bash
git add web/prisma/importChores.ts web/package.json
git commit -m "feat: CLI npm run import:chores

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: PWA-Manifest + Icon + Layout-Metadata

Macht die App im Tablet-Chrome als Vollbild-App installierbar. SVG-Icon (kein Binär-Asset, kein Service-Worker).

**Files:**
- Create: `web/public/manifest.webmanifest`
- Create: `web/public/icon.svg`
- Modify: `web/src/app/layout.tsx`
- Test: `web/src/app/manifest.test.ts`

- [ ] **Step 1: Failing-Test schreiben**

Create `web/src/app/manifest.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("PWA manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "public", "manifest.webmanifest"), "utf-8"),
  );

  it("is installable as a standalone app", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(typeof manifest.name).toBe("string");
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  it("declares 192 and 512 icon sizes", () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("declares a maskable icon", () => {
    const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? "");
    expect(purposes.join(" ")).toContain("maskable");
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/app/manifest.test.ts` (aus `web/`)
Expected: FAIL — `public/manifest.webmanifest` existiert nicht.

- [ ] **Step 3: Icon + Manifest anlegen**

Create `web/public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f766e"/>
  <path d="M256 112 120 224v176h80v-96h112v96h80V224z" fill="#ffffff"/>
</svg>
```

Create `web/public/manifest.webmanifest`:

```json
{
  "name": "Haushalts-Cockpit",
  "short_name": "Cockpit",
  "description": "Familien-Dashboard — Aufgaben, Termine, Essensplan und Einkauf.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#0b0f14",
  "theme_color": "#0f766e",
  "icons": [
    { "src": "/icon.svg", "sizes": "192x192", "type": "image/svg+xml", "purpose": "any" },
    { "src": "/icon.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "any" },
    { "src": "/icon.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/app/manifest.test.ts` (aus `web/`)
Expected: PASS.

- [ ] **Step 5: Layout-Metadata + Viewport ergänzen**

In `web/src/app/layout.tsx` den Import-Typ erweitern und Metadata/Viewport ergänzen. Zeile 1 ersetzen:

```ts
import type { Metadata, Viewport } from "next";
```

Den `metadata`-Export ersetzen durch:

```ts
export const metadata: Metadata = {
  title: "Haushalts-Cockpit · Heute",
  description:
    "Ruhiges Familien-Dashboard — Aufgaben, Termine, Essensplan und Einkauf an einem Ort. Mental Load reduzieren.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cockpit", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

- [ ] **Step 6: Typecheck + Build prüfen**

Run (aus `web/`): `npm run typecheck`
Expected: kein Fehler.
Run (aus `web/`): `npm run build`
Expected: Build erfolgreich; keine Manifest-/Metadata-Warnungen.

- [ ] **Step 7: Commit**

```bash
git add web/public/manifest.webmanifest web/public/icon.svg web/src/app/layout.tsx web/src/app/manifest.test.ts
git commit -m "feat: PWA-Manifest + Icon, App am Tablet installierbar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Termux-Runbook + Start-Skript + .env-Vorlage

Doku und Helfer, um den Server am Tablet einzurichten und zu starten. Keine automatischen Tests (Doku/Skript) — Verifikation am echten Gerät.

**Files:**
- Create: `docs/tablet-termux-setup.md`
- Create: `scripts/tablet-start.sh`
- Create: `web/.env.example`

- [ ] **Step 1: `.env`-Vorlage anlegen**

Create `web/.env.example`:

```sh
# Lokale SQLite-Datei (Default reicht für den Tablet-Betrieb)
DATABASE_URL="file:./dev.db"

# Optional — nur für Google-Kalender-Sync (Phase 4). Ohne diese Werte läuft die
# App, der Kalender-Sync ist dann inaktiv.
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3001/api/auth/google/callback"

# Optional — nur für Bring!-Einkaufs-Sync.
BRING_EMAIL=""
BRING_PASSWORD=""
```

- [ ] **Step 2: Start-Skript anlegen**

Create `scripts/tablet-start.sh`:

```sh
#!/data/data/com.termux/files/usr/bin/bash
# Startet das Haushalts-Dashboard am Tablet. Aufruf: bash scripts/tablet-start.sh
# (auch via Termux:Boot). Bindet 0.0.0.0 -> spaeterer Handy-Zugriff im WLAN frei.
set -e

# Doze/Sleep des Servers verhindern, solange er laeuft.
termux-wake-lock 2>/dev/null || true

cd "$(dirname "$0")/../web"

# Produktions-Server (vorher 'npm run build' ausfuehren).
HOST=0.0.0.0 npm run start -- -H 0.0.0.0 -p 3001
```

- [ ] **Step 3: Runbook schreiben**

Create `docs/tablet-termux-setup.md`:

````markdown
# Dashboard am Pixel Tablet (Termux) betreiben

Das Dashboard läuft als Node-Server direkt am Tablet; Chrome zeigt es als
installierte PWA. Möglich, weil Prisma den **better-sqlite3 Driver-Adapter**
nutzt — die Rust-Query-Engine (üblicher Android-Blocker) entfällt, nur
`better-sqlite3` wird nativ gebaut.

## Einmalige Einrichtung

1. **Termux** installieren (F-Droid empfohlen, aktueller als Play Store).
   Optional **Termux:Boot** für Autostart.
2. Pakete installieren:
   ```sh
   pkg update && pkg install nodejs-lts git python clang make termux-api
   ```
3. Repo holen und Abhängigkeiten installieren (baut `better-sqlite3` nativ):
   ```sh
   git clone <REPO-URL> haushalts-dashboard
   cd haushalts-dashboard/web
   npm ci
   ```
4. Umgebung anlegen:
   ```sh
   cp .env.example .env
   # .env reicht mit DATABASE_URL; Google/Bring optional.
   ```
5. Datenbank vorbereiten und Chores importieren:
   ```sh
   npx prisma migrate deploy
   node node_modules/prisma/build/index.js generate
   npm run import:chores
   ```
   > Optional für eine *saubere* Echt-DB ohne Demo-Daten: vor `import:chores`
   > **keinen** Demo-Seed laufen lassen. Der Import ist additiv (Upsert nach
   > Titel) und löscht nichts.
6. Produktions-Build:
   ```sh
   npm run build
   ```

## Starten

```sh
cd ~/haushalts-dashboard
bash scripts/tablet-start.sh
```

Der Server lauscht auf `0.0.0.0:3001`. Am Tablet Chrome öffnen:
`http://localhost:3001` → Menü → **App installieren** / *Zum Startbildschirm*.
Die PWA startet danach im Vollbild.

## Wach bleiben (Kiosk)

- Tablet am Strom lassen; Android *Entwickleroptionen → „Aktiv lassen"* (beim
  Laden wach).
- `scripts/tablet-start.sh` ruft `termux-wake-lock`, damit der Server nicht in
  Doze geht.

## Autostart (optional, Termux:Boot)

Datei `~/.termux/boot/start-dashboard.sh` anlegen:
```sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
bash ~/haushalts-dashboard/scripts/tablet-start.sh
```
Ausführbar machen: `chmod +x ~/.termux/boot/start-dashboard.sh`.

## Später: Handy-Zugriff aufs Tablet

Der Server bindet bereits `0.0.0.0`. Sobald gewünscht: Tablet-IP im WLAN
ermitteln (`ifconfig` / Router) und am Handy `http://<TABLET-IP>:3001` öffnen.
(Nicht Teil dieser Einrichtung.)

## Schneller bauen (optional)

`.next` ist portabler JS-Output und kann am PC gebaut (`npm run build`) und aufs
Tablet kopiert werden; nur `npm ci` (native Module) muss am Tablet laufen.
Default ist Build am Tablet — einfacher, weniger Fehlerquellen.
````

- [ ] **Step 4: Skript ausführbar markieren (informativ)**

Run: `git add scripts/tablet-start.sh && git update-index --chmod=+x scripts/tablet-start.sh`
Expected: kein Fehler (setzt das Ausführbar-Bit im Git-Index für Linux/Termux).

- [ ] **Step 5: Commit**

```bash
git add docs/tablet-termux-setup.md scripts/tablet-start.sh web/.env.example
git commit -m "docs: Termux-Runbook + Start-Skript + .env-Vorlage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Gesamt-Verifikation + README

Sicherstellen, dass die ganze Suite grün ist und der README den Tablet-Betrieb erwähnt.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Volle Testsuite**

Run (aus `web/`): `npm test`
Expected: PASS, alle Tests (bestehende 217 + neue aus Task 1/2/3/5).

- [ ] **Step 2: README-Abschnitt ergänzen**

In `README.md` vor dem letzten Absatz („Der finale visuelle Look…") einfügen:

```markdown
## Betrieb am Tablet

Das Dashboard kann lokal auf einem Android-Tablet (z.B. Google Pixel Tablet)
laufen — Node-Server in Termux, im Chrome als PWA installiert. Anleitung:
[`docs/tablet-termux-setup.md`](docs/tablet-termux-setup.md).
Die echten Haushalts-Chores werden idempotent per `npm run import:chores`
eingespielt (siehe `web/src/lib/services/chores.ts`).
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README erwaehnt Tablet-Betrieb + Chore-Import

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review-Notiz (vom Plan-Autor)

- **Spec-Abdeckung:** Komponente 1 → Task 1; Komponente 2 → Tasks 2–4; Komponente 3 → Task 5; Komponente 4 → Task 6; Verifikation/Doku → Task 7. Alle Spec-Abschnitte abgedeckt.
- **Reviewfeedback:** Rasen `allowedPersons:"dome"` (Task 2 Daten + Task 3 Test); Bad groß/klein verschiedene Tage (Task 2 Stagger + Test). Icons gesetzt.
- **Follow-up Hundefutter-Vorrats-Rechner** ist bewusst NICHT eingeplant (Out-of-scope laut Spec).
- **Typ-Konsistenz:** `ChoreInput`/`ChoreTaskData`, `buildChoreTasks`, `importChores(client, today)` durchgängig gleich benannt.
