# Google Kalender — Termine, Verteilung & Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google-Kalender-Termine fließen automatisch (stündlich + bei Start + per Button) ins Dashboard und steuern über eine Hybrid-Tageskapazität, wie Aufgaben auf Dome/Emely verteilt werden.

**Architecture:** Reine Engine-Erweiterung (Tageskapazität: harte Sperre ≥80% + weicher Fairness-Bias) bleibt netz-/DB-frei und wird über das bestehende Injection-Muster (`planDueTasks`) gefüttert. Ein extrahierter `calendarSync`-Service speist HTTP-Route, CLI-Script und Server-Action. Auto-Sync via `tablet-start.sh` + Termux-Cron; manueller Sync-Button auf Tablet (Topbar) und Handy (PageHeader).

**Tech Stack:** Next.js (Server Actions, App Router), Prisma + SQLite, TypeScript, Vitest, Termux/bash. Google Calendar REST über bestehendes `@/integrations/calendar`.

## Global Constraints

- **NICHT das Next.js aus dem Training:** vor Next-spezifischem Code die Guides in `node_modules/next/dist/docs/` lesen (siehe `web/AGENTS.md`).
- **Betriebsschutz:** Umsetzung ausschließlich im git-Worktree mit eigener `.env` + isolierter `dev.db`; **niemals** `main`/Prod-DB; keine Migration gegen Prod. Dieses Feature braucht **keine** Schema-Änderung — alle Modelle (`CalendarEvent`, `OAuthToken`) existieren.
- **Pure-Engine-Regel:** alles unter `src/lib/engine/**` importiert **nicht** aus db/repositories/integrations/next/prisma.
- **TDD:** jeder Schritt erst Test (rot), dann minimale Implementierung (grün), dann Commit. Bestehende **237 Tests bleiben grün**.
- **Aktiver Tag:** lokal **08:00–22:00**. **Voll-Schwelle:** `FULL_THRESHOLD = 0.8`.
- **Tests laufen:** `npm test` (= `vitest run`). Einzeltest: `npx vitest run <pfad> -t "<name>"`.

---

### Task 1: Fairness — weicher Last-Bias (`loadPenalty`)

**Files:**
- Modify: `src/lib/engine/fairness.ts`
- Test: `src/lib/engine/fairness.test.ts`

**Interfaces:**
- Consumes: `Balances`, `PersonKey` aus `./types`.
- Produces: `selectByFairness(persons, balances, target, loadPenalty?: Record<PersonKey, number>): PersonKey` — bei gesetztem `loadPenalty` wird das Defizit jeder Person mit `(1 − loadPenalty[person])` multipliziert, bevor verglichen wird. Ohne den Parameter unverändert.

- [ ] **Step 1: Failing test ergänzen**

In `src/lib/engine/fairness.test.ts` im `describe("selectByFairness", …)` ergänzen:

```ts
it("biases away from a busy person via loadPenalty", () => {
  // Gleiche Ausgangslage (beide 0, 50/50) → ohne Penalty gewinnt dome (PERSON_ORDER).
  const balances: Balances = { dome: 0, emely: 0 };
  expect(selectByFairness(persons, balances, { dome: 50, emely: 50 })).toBe("dome");
  // Dome zu 90% belegt → sein Defizit wird stark gedämpft → emely gewinnt.
  expect(
    selectByFairness(persons, balances, { dome: 50, emely: 50 }, { dome: 0.9, emely: 0 }),
  ).toBe("emely");
});

it("ignores loadPenalty for a single candidate", () => {
  const balances: Balances = { dome: 0, emely: 100 };
  expect(selectByFairness(["dome"], balances, { dome: 50, emely: 50 }, { dome: 0.9, emely: 0 })).toBe("dome");
});
```

- [ ] **Step 2: Test rot**

Run: `npx vitest run src/lib/engine/fairness.test.ts -t "loadPenalty"`
Expected: FAIL (TypeScript-Fehler: `selectByFairness` erwartet 3 Argumente / 4. Argument unbekannt).

- [ ] **Step 3: Implementierung**

`selectByFairness` in `src/lib/engine/fairness.ts` ersetzen:

```ts
/**
 * Picks the candidate with the greatest deficit (target share minus actual share),
 * i.e. the person most behind their fairness target. Ties broken by higher target,
 * then by `PERSON_ORDER`.
 *
 * `loadPenalty` (Anteil 0…1 pro Person, optional) dämpft das Defizit einer
 * belegten Person: das verglichene Defizit wird mit `(1 − loadPenalty[person])`
 * multipliziert. Eine stark belegte Person wirkt damit „ausgelasteter" und wird
 * seltener gewählt. Ohne `loadPenalty` identisches Verhalten wie zuvor.
 */
export function selectByFairness(
  persons: PersonKey[],
  balances: Balances,
  target: Record<PersonKey, number>,
  loadPenalty?: Record<PersonKey, number>,
): PersonKey {
  if (persons.length === 1) return persons[0];

  const actual = computeShare(balances);
  const weighted = (p: PersonKey) => (target[p] - actual[p]) * (1 - (loadPenalty?.[p] ?? 0));

  return [...persons].sort((a, b) => {
    const deficitA = weighted(a);
    const deficitB = weighted(b);
    if (deficitA !== deficitB) return deficitB - deficitA;

    if (target[a] !== target[b]) return target[b] - target[a];

    return PERSON_ORDER.indexOf(a) - PERSON_ORDER.indexOf(b);
  })[0];
}
```

- [ ] **Step 4: Test grün**

Run: `npx vitest run src/lib/engine/fairness.test.ts`
Expected: PASS (alle, inkl. Alt-Tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/fairness.ts src/lib/engine/fairness.test.ts
git commit -m "feat(engine): optional loadPenalty bias in selectByFairness"
```

---

### Task 2: Tageskapazität — pures `capacity.ts`

**Files:**
- Create: `src/lib/engine/capacity.ts`
- Test: `src/lib/engine/capacity.test.ts`

**Interfaces:**
- Consumes: `BusyWindow`, `PersonKey` aus `./types`.
- Produces:
  - `activeDayWindow(day: Date): { start: Date; end: Date }` — lokal 08:00–22:00 des `day`.
  - `dayLoad(busy: BusyWindow[], window: { start: Date; end: Date }): Record<PersonKey, number>` — Belegungsanteil 0…1 pro Person; überlappende Fenster werden gemerged und auf `window` geclippt.

- [ ] **Step 1: Failing test**

`src/lib/engine/capacity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { activeDayWindow, dayLoad } from "./capacity";
import type { BusyWindow } from "./types";

const W = activeDayWindow(new Date(2026, 5, 10)); // 08:00–22:00, 14h

function at(h: number, m = 0): Date {
  return new Date(2026, 5, 10, h, m);
}

describe("activeDayWindow", () => {
  it("spans local 08:00–22:00 of the given day", () => {
    expect(W.start.getHours()).toBe(8);
    expect(W.end.getHours()).toBe(22);
  });
});

describe("dayLoad", () => {
  it("returns 0 for both when nobody is busy", () => {
    expect(dayLoad([], W)).toEqual({ dome: 0, emely: 0 });
  });

  it("computes the covered fraction of the active day per person", () => {
    const busy: BusyWindow[] = [{ person: "dome", start: at(8), end: at(15) }]; // 7h / 14h = 0.5
    const load = dayLoad(busy, W);
    expect(load.dome).toBeCloseTo(0.5, 5);
    expect(load.emely).toBe(0);
  });

  it("clips busy windows to the active day (early/late edges don't over-count)", () => {
    const busy: BusyWindow[] = [{ person: "emely", start: at(6), end: at(9) }]; // nur 08–09 zählt = 1h/14h
    expect(dayLoad(busy, W).emely).toBeCloseTo(1 / 14, 5);
  });

  it("merges overlapping windows instead of double-counting", () => {
    const busy: BusyWindow[] = [
      { person: "dome", start: at(8), end: at(12) },
      { person: "dome", start: at(10), end: at(15) }, // Überlappung 10–12
    ]; // Union 08–15 = 7h / 14h
    expect(dayLoad(busy, W).dome).toBeCloseTo(0.5, 5);
  });

  it("caps a full/overnight coverage at 1", () => {
    const busy: BusyWindow[] = [{ person: "dome", start: at(0), end: at(14) }]; // Nacht→14:00: 08–14 = 6h
    expect(dayLoad(busy, W).dome).toBeCloseTo(6 / 14, 5);
    const all: BusyWindow[] = [{ person: "emely", start: at(7), end: at(23) }];
    expect(dayLoad(all, W).emely).toBe(1);
  });
});
```

- [ ] **Step 2: Test rot**

Run: `npx vitest run src/lib/engine/capacity.test.ts`
Expected: FAIL ("Cannot find module './capacity'").

- [ ] **Step 3: Implementierung**

`src/lib/engine/capacity.ts`:

```ts
// Pure Tageskapazität: welcher Anteil des "aktiven Tages" (08:00–22:00) ist pro
// Person durch BusyWindows (Termine/Schichten, inkl. Nacht→14:00-Korrektur aus
// @/lib/repositories/calendar) belegt. Kein db/next/prisma — Engine-Pure-Regel.

import type { BusyWindow, PersonKey } from "./types";

const ACTIVE_START_HOUR = 8;
const ACTIVE_END_HOUR = 22;
const PERSONS: PersonKey[] = ["dome", "emely"];

/** Lokales 08:00–22:00-Fenster des `day`. */
export function activeDayWindow(day: Date): { start: Date; end: Date } {
  const start = new Date(day);
  start.setHours(ACTIVE_START_HOUR, 0, 0, 0);
  const end = new Date(day);
  end.setHours(ACTIVE_END_HOUR, 0, 0, 0);
  return { start, end };
}

/** Summe der auf `window` geclippten, gemergten Intervall-Längen (ms). */
function coveredMs(
  windows: { start: Date; end: Date }[],
  window: { start: Date; end: Date },
): number {
  const clipped = windows
    .map((w) => ({
      start: Math.max(w.start.getTime(), window.start.getTime()),
      end: Math.min(w.end.getTime(), window.end.getTime()),
    }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const w of clipped) {
    if (w.start > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = w.start;
      curEnd = w.end;
    } else {
      curEnd = Math.max(curEnd, w.end);
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

/**
 * Belegungsanteil 0…1 pro Person über `window`. Überlappende Fenster werden
 * gemerged (keine Doppelzählung), auf `window` geclippt. Leeres `window`
 * (Länge 0) → 0 für alle.
 */
export function dayLoad(
  busy: BusyWindow[],
  window: { start: Date; end: Date },
): Record<PersonKey, number> {
  const span = window.end.getTime() - window.start.getTime();
  const result = { dome: 0, emely: 0 } as Record<PersonKey, number>;
  if (span <= 0) return result;

  for (const person of PERSONS) {
    const mine = busy.filter((b) => b.person === person);
    result[person] = coveredMs(mine, window) / span;
  }
  return result;
}
```

- [ ] **Step 4: Test grün**

Run: `npx vitest run src/lib/engine/capacity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/capacity.ts src/lib/engine/capacity.test.ts
git commit -m "feat(engine): pure dayLoad capacity over active day window"
```

---

### Task 3: `planTask` — Hybrid-Kapazität (harte Sperre + weicher Bias)

**Files:**
- Modify: `src/lib/engine/types.ts` (PlanInput um `dayLoad?` erweitern)
- Modify: `src/lib/engine/index.ts`
- Test: `src/lib/engine/index.test.ts`

**Interfaces:**
- Consumes: `selectByFairness(..., loadPenalty?)` (Task 1), `PlanInput.dayLoad?: Record<PersonKey, number>`.
- Produces: `planTask` schließt Personen mit `dayLoad[person] ≥ 0.8` aus; bleibt keiner → `{ kind: "unassignable", reason: "ganztägig belegt" }`; sonst weicher Bias über `loadPenalty = dayLoad`. Ohne `dayLoad` unverändert.

- [ ] **Step 1: `PlanInput` erweitern**

In `src/lib/engine/types.ts` im `PlanInput`-Interface nach `busy: BusyWindow[];` ergänzen:

```ts
  /**
   * Belegungsanteil 0…1 pro Person für `day` (aus `@/lib/engine/capacity`'s
   * `dayLoad`, vom Caller injiziert). `≥ 0.8` → Person an dem Tag gesperrt;
   * sonst dämpft der Wert die Fairness-Auswahl. Fehlt das Feld, wirkt keine
   * Kapazitäts-Logik (Alt-Verhalten).
   */
  dayLoad?: Record<PersonKey, number>;
```

- [ ] **Step 2: Failing tests**

In `src/lib/engine/index.test.ts` neues `describe` ergänzen:

```ts
describe("planTask — Tageskapazität", () => {
  const task: EngineTask = { id: "cap", allowedPersons: "both", outdoor: false, effort: 1 };

  it("excludes a person whose day is fully booked (load ≥ 0.8) and assigns the other", () => {
    // Ohne Kapazität gewänne dome (60/40, beide 0). Dome zu 90% belegt → emely.
    const result = planTask(baseInput({ task, dayLoad: { dome: 0.9, emely: 0.1 } }));
    expect(result).toEqual({ kind: "assigned", person: "emely", day: day(10) });
  });

  it("returns unassignable when everyone left is fully booked", () => {
    const result = planTask(baseInput({ task, dayLoad: { dome: 0.85, emely: 0.95 } }));
    expect(result).toEqual({ kind: "unassignable", reason: "ganztägig belegt" });
  });

  it("applies a soft bias for partial load without hard-excluding", () => {
    // 50/50, beide 0 → ohne Last gewänne dome. Dome 60% belegt (<0.8) → Bias → emely.
    const result = planTask(
      baseInput({ task, phase: { mode: "normal", target: { dome: 50, emely: 50 } }, dayLoad: { dome: 0.6, emely: 0 } }),
    );
    expect(result).toEqual({ kind: "assigned", person: "emely", day: day(10) });
  });
});
```

- [ ] **Step 3: Test rot**

Run: `npx vitest run src/lib/engine/index.test.ts -t "Tageskapazität"`
Expected: FAIL (Bias/Sperre noch nicht implementiert → falsche Person bzw. kein "ganztägig belegt").

- [ ] **Step 4: Implementierung**

`src/lib/engine/index.ts` ersetzen:

```ts
import { filterByAvailability } from "./availability";
import { selectByFairness } from "./fairness";
import { filterByPerson } from "./personFilter";
import type { PersonKey, PlanInput, PlanResult } from "./types";
import { checkWeather } from "./weatherCheck";

/** Ab diesem Tages-Belegungsanteil gilt eine Person als ganztägig blockiert. */
const FULL_THRESHOLD = 0.8;

/**
 * Plans a single task: filters candidates by who's allowed, defers if outdoor
 * weather doesn't permit it, filters by availability, removes anyone whose day
 * is fully booked (`dayLoad ≥ FULL_THRESHOLD`), then picks the fairest
 * remaining candidate — biased away from partially-busy people via `dayLoad`.
 */
export function planTask(input: PlanInput): PlanResult {
  const { task, day, window, persons, busy, forecast, phase, balances, dayLoad } = input;

  const candidates = filterByPerson(task, persons);
  if (candidates.length === 0) {
    return { kind: "unassignable", reason: "niemand erlaubt" };
  }

  if (task.outdoor) {
    const weather = checkWeather(task, day, forecast, window);
    if (!weather.ok) {
      return { kind: "deferred", reason: weather.reason, suggestedDay: weather.suggestedDay };
    }
  }

  const available = filterByAvailability(candidates, window, busy);
  if (available.length === 0) {
    return { kind: "unassignable", reason: "niemand verfügbar" };
  }

  const free = dayLoad
    ? available.filter((p: PersonKey) => (dayLoad[p] ?? 0) < FULL_THRESHOLD)
    : available;
  if (free.length === 0) {
    return { kind: "unassignable", reason: "ganztägig belegt" };
  }

  const person = selectByFairness(free, balances, phase.target, dayLoad);
  return { kind: "assigned", person, day };
}
```

- [ ] **Step 5: Tests grün**

Run: `npx vitest run src/lib/engine/index.test.ts`
Expected: PASS (Alt-Tests + neue).

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/types.ts src/lib/engine/index.ts src/lib/engine/index.test.ts
git commit -m "feat(engine): capacity-aware planTask (hard block ≥0.8 + soft bias)"
```

---

### Task 4: `calendarSync`-Service extrahieren + Route refactoren

**Files:**
- Create: `src/lib/services/calendarSync.ts`
- Create: `src/lib/services/calendarSync.test.ts`
- Modify: `src/app/api/sync/calendar/route.ts`

**Interfaces:**
- Consumes: `fetchEvents`, `CalendarEventInput` aus `@/integrations/calendar/google`; `upsertEvents` aus `@/lib/repositories/calendar`.
- Produces:
  - `configuredCalendars(): { calendarId: string; calendarKey: string }[]`
  - `type EventFetcher = (calendarId: string, calendarKey: string, from: Date, to: Date) => Promise<CalendarEventInput[]>`
  - `syncCalendar(calendars?, deps?: { fetch?: EventFetcher; client?: PrismaClient }): Promise<{ synced: number }>` — zieht 14 Tage je Kalender, upsertet, gibt Anzahl zurück; wirft bei Netz-/Auth-Fehlern.

- [ ] **Step 1: Failing test**

`src/lib/services/calendarSync.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { getTodaysEvents } from "@/lib/repositories/calendar";
import { syncCalendar } from "./calendarSync";

describe("calendarSync service", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("fetches each configured calendar and upserts the events", async () => {
    const now = new Date();
    const fetch = async (_id: string, calendarKey: string) => [
      {
        externalId: `${calendarKey}:e1`,
        calendarKey,
        title: "Sport",
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0),
        personKey: "dome" as const,
        kind: "termin" as const,
        place: null,
      },
    ];

    const result = await syncCalendar([{ calendarId: "cid", calendarKey: "dome" }], { fetch, client });

    expect(result).toEqual({ synced: 1 });
    const events = await getTodaysEvents(new Date(), client);
    expect(events.map((e) => e.title)).toContain("Sport");
  });

  it("propagates a fetch error (e.g. not connected)", async () => {
    const fetch = async () => {
      throw new Error("not connected");
    };
    await expect(
      syncCalendar([{ calendarId: "cid", calendarKey: "dome" }], { fetch, client }),
    ).rejects.toThrow("not connected");
  });
});
```

- [ ] **Step 2: Test rot**

Run: `npx vitest run src/lib/services/calendarSync.test.ts`
Expected: FAIL ("Cannot find module './calendarSync'").

- [ ] **Step 3: Service implementieren**

`src/lib/services/calendarSync.ts`:

```ts
// Sync-Kern: zieht die nächsten 14 Tage aus den konfigurierten Google-Kalendern
// und upsertet sie in `CalendarEvent`. Gemeinsam genutzt von der HTTP-Route,
// dem CLI-Script (`prisma/syncCalendar.ts`) und der Server-Action.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { fetchEvents, type CalendarEventInput } from "@/integrations/calendar/google";
import { upsertEvents } from "@/lib/repositories/calendar";

const SYNC_WINDOW_DAYS = 14;

export type EventFetcher = (
  calendarId: string,
  calendarKey: string,
  from: Date,
  to: Date,
) => Promise<CalendarEventInput[]>;

/** Mappt jede Kalender-Env-Var auf ihren `calendarKey`; Einträge ohne Wert werden übersprungen. */
export function configuredCalendars(): { calendarId: string; calendarKey: string }[] {
  const candidates: { calendarKey: string; calendarId: string | undefined }[] = [
    { calendarKey: "dome", calendarId: process.env.GOOGLE_CALENDAR_DOME },
    { calendarKey: "emely", calendarId: process.env.GOOGLE_CALENDAR_EMELY },
    { calendarKey: "family", calendarId: process.env.GOOGLE_CALENDAR_FAMILY },
    { calendarKey: "dome_dienstplan", calendarId: process.env.GOOGLE_CALENDAR_DOME_DIENSTPLAN },
    { calendarKey: "dome_verein", calendarId: process.env.GOOGLE_CALENDAR_DOME_VEREIN },
    { calendarKey: "geburtstage", calendarId: process.env.GOOGLE_CALENDAR_GEBURTSTAGE },
  ];

  return candidates
    .filter((c): c is { calendarKey: string; calendarId: string } => Boolean(c.calendarId))
    .map((c) => ({ calendarId: c.calendarId, calendarKey: c.calendarKey }));
}

/**
 * Zieht je Kalender die nächsten 14 Tage und upsertet sie. Wirft bei Netz-/
 * Auth-Fehlern (aus `fetchEvents`) — der Caller entscheidet über Status/Degradation.
 * `deps.fetch`/`deps.client` sind für Tests injizierbar.
 */
export async function syncCalendar(
  calendars: { calendarId: string; calendarKey: string }[] = configuredCalendars(),
  deps: { fetch?: EventFetcher; client?: PrismaClient } = {},
): Promise<{ synced: number }> {
  const { fetch = fetchEvents, client = prisma } = deps;

  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + SYNC_WINDOW_DAYS);

  let all: CalendarEventInput[] = [];
  for (const { calendarId, calendarKey } of calendars) {
    const events = await fetch(calendarId, calendarKey, from, to);
    all = all.concat(events);
  }

  await upsertEvents(all, client);
  return { synced: all.length };
}
```

- [ ] **Step 4: Test grün**

Run: `npx vitest run src/lib/services/calendarSync.test.ts`
Expected: PASS.

- [ ] **Step 5: Route auf den Service reduzieren**

`src/app/api/sync/calendar/route.ts` ersetzen (Verhalten/Statuscodes unverändert: 400 ohne Kalender, 502 bei Sync-Fehler):

```ts
// GET|POST /api/sync/calendar — pulls the next 14 days from each configured
// Google Calendar and upserts them into `CalendarEvent` via the shared
// `syncCalendar` service. Read-only towards Google. "Not connected"/network
// errors become a clean JSON error rather than crashing.

import { NextResponse } from "next/server";

import { configuredCalendars, syncCalendar } from "@/lib/services/calendarSync";

async function runSync() {
  const calendars = configuredCalendars();

  if (calendars.length === 0) {
    return NextResponse.json(
      { error: "No calendars configured — set GOOGLE_CALENDAR_DOME/EMELY/FAMILY/DOME_DIENSTPLAN/DOME_VEREIN/GEBURTSTAGE (see docs/setup/google-calendar.md)." },
      { status: 400 },
    );
  }

  try {
    const result = await syncCalendar(calendars);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Calendar sync failed" },
      { status: 502 },
    );
  }
}

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}
```

- [ ] **Step 6: Voller Testlauf + Commit**

Run: `npm test`
Expected: PASS (237 + neue).

```bash
git add src/lib/services/calendarSync.ts src/lib/services/calendarSync.test.ts src/app/api/sync/calendar/route.ts
git commit -m "refactor(calendar): extract syncCalendar service, route delegates to it"
```

---

### Task 5: CLI-Sync-Script + Auto-Sync-Hooks (Start + Cron)

**Files:**
- Create: `prisma/syncCalendar.ts`
- Create: `scripts/tablet-sync.sh`
- Modify: `package.json` (Script `sync:calendar`)
- Modify: `scripts/tablet-start.sh`

**Interfaces:**
- Consumes: `syncCalendar`, `configuredCalendars` (Task 4); `prisma` aus `@/lib/db`.
- Produces: `npm run sync:calendar` (CLI); `scripts/tablet-sync.sh` (Sync + Re-Plan, für Termux-Cron).

- [ ] **Step 1: CLI-Script schreiben**

`prisma/syncCalendar.ts`:

```ts
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { configuredCalendars, syncCalendar } from "../src/lib/services/calendarSync";

// Zieht die nächsten 14 Tage aus allen konfigurierten Google-Kalendern in die DB.
// Aufruf: npm run sync:calendar  (u.a. via scripts/tablet-start.sh + Termux-Cron).
async function main() {
  const calendars = configuredCalendars();
  if (calendars.length === 0) {
    console.error("Keine Kalender konfiguriert (GOOGLE_CALENDAR_* in .env).");
    process.exitCode = 1;
    return;
  }

  try {
    const { synced } = await syncCalendar(calendars);
    console.log(`Kalender-Sync: ${synced} Termine aktualisiert.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: package.json-Script ergänzen**

In `package.json` bei `scripts` nach `"plan:today": "tsx prisma/planToday.ts"` ergänzen:

```json
    "sync:calendar": "tsx prisma/syncCalendar.ts",
```

- [ ] **Step 3: Smoke-Run (manuell, im Worktree mit gültigem Token)**

Run: `npm run sync:calendar`
Expected: `Kalender-Sync: N Termine aktualisiert.` (N ≥ 0). Bei „not connected" klare Fehlermeldung → Token im Worktree über `/api/auth/google` erneuern. Kein Crash.

- [ ] **Step 4: `tablet-start.sh` — Sync vor Plan**

In `scripts/tablet-start.sh` direkt **vor** der `npm run plan:today`-Zeile einfügen:

```bash
# Google-Kalender vor der Verteilung syncen, damit die Engine frische Termine/
# Schichten sieht. Fehler (offline/nicht verbunden) darf den Start nicht blockieren.
npm run sync:calendar || true
```

- [ ] **Step 5: `tablet-sync.sh` für den stündlichen Cron**

`scripts/tablet-sync.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash
# Stündlicher Kalender-Sync + Neu-Verteilung der heute fälligen Aufgaben.
# Eingehängt via termux-job-scheduler (siehe Step 6). Idempotent, gefahrlos.
set -e
cd "$(dirname "$0")/../web"
npm run sync:calendar || true
npm run plan:today || true
```

- [ ] **Step 6: Termux-Cron einhängen (Dokumentation im Script-Kopf-Kommentar + manuell am Tablet)**

Am Tablet (Termux) einmalig — gehört in die Inbetriebnahme, nicht in den Test:

```bash
chmod +x scripts/tablet-sync.sh
termux-job-scheduler \
  --script "$HOME/Dashboard/scripts/tablet-sync.sh" \
  --period-ms 3600000 \
  --persisted true
```

- [ ] **Step 7: Commit**

```bash
git add prisma/syncCalendar.ts package.json scripts/tablet-start.sh scripts/tablet-sync.sh
git commit -m "feat(calendar): sync:calendar CLI + start-hook + hourly tablet-sync"
```

---

### Task 6: Wire-up — `planDueTasks`/`planToday.ts` füttern busy + forecast

**Files:**
- Modify: `src/lib/services/planning.ts`
- Modify: `prisma/planToday.ts`
- Test: `src/lib/services/planning.test.ts`

**Interfaces:**
- Consumes: `getBusyWindows` (`@/lib/repositories/calendar`), `getForecast` (`@/integrations/weather/openMeteo`), `dayLoad`/`activeDayWindow` (Task 2).
- Produces: `planDueTasks` berechnet aus `opts.busy` via `dayLoad` das `dayLoad`-Objekt für `day` und reicht es pro Task an `planTask`. `planToday.ts` injiziert `busy` + `forecast`.

- [ ] **Step 1: Failing test (busy blockt Person → Aufgabe geht an die andere)**

In `src/lib/services/planning.test.ts` ergänzen. **Den bereits vorhandenen Helper `createOpenStandaloneTask` nutzen** (legt eine offene, unzugewiesene, standalone Aufgabe mit `type: "todo"`, `dueDate: today` an — `Task` hat **kein** `person`-Feld, Zuweisung läuft über `assignedToId`). Test gibt Dome ein den ganzen aktiven Tag deckendes Busy-Window und erwartet Zuweisung an Emely:

```ts
it("assigns away from a person whose day is fully booked (busy → dayLoad)", async () => {
  await createOpenStandaloneTask({ title: "Wäsche", allowedPersons: "both", effort: 1 });

  // `today` ist im Test-Scope als `const today = new Date()` vorhanden; createOpenStandaloneTask setzt dueDate: today.
  const d = today.getDate();
  const busy = [
    {
      person: "dome" as const,
      start: new Date(today.getFullYear(), today.getMonth(), d, 7, 0),
      end: new Date(today.getFullYear(), today.getMonth(), d, 23, 0),
    },
  ];

  const decisions = await planDueTasks(today, { busy }, client);

  expect(decisions).toHaveLength(1);
  expect(decisions[0].result).toMatchObject({ kind: "assigned", person: "emely" });
});
```

> Hinweis: `planDueTasks(today, …)` nutzt `dayBounds(today)`; `createOpenStandaloneTask` setzt `dueDate: today` (= `new Date()` mit Uhrzeit). Liegt `today` durch die Uhrzeit am Tagesrand, beim Anlegen ggf. wie die Alt-Tests verfahren (sie tun dasselbe und sind grün). `dayLoad` nutzt `activeDayWindow(today)` (08–22), das Busy 07–23 deckt 08–22 voll → `load.dome = 1 ≥ 0.8` → dome gesperrt.

- [ ] **Step 2: Test rot**

Run: `npx vitest run src/lib/services/planning.test.ts -t "fully booked"`
Expected: FAIL (ohne `dayLoad`-Weitergabe wird die Aufgabe nach Fairness an dome verteilt).

- [ ] **Step 3: `planDueTasks` — dayLoad ableiten & durchreichen**

In `src/lib/services/planning.ts`:

Import ergänzen:

```ts
import { activeDayWindow, dayLoad as computeDayLoad } from "@/lib/engine/capacity";
```

In `planDueTasks`, nach `const { forecast = [], busy = [] } = opts;` ergänzen:

```ts
  const load = computeDayLoad(busy, activeDayWindow(day));
```

Im `PlanInput`-Objekt (in der `for`-Schleife) das Feld ergänzen:

```ts
    const input: PlanInput = {
      task,
      day,
      window: undefined,
      persons: ["dome", "emely"],
      busy,
      forecast,
      phase,
      balances,
      dayLoad: load,
    };
```

- [ ] **Step 4: Test grün**

Run: `npx vitest run src/lib/services/planning.test.ts`
Expected: PASS (Alt-Tests + neuer).

- [ ] **Step 5: `planToday.ts` — busy + forecast injizieren**

`prisma/planToday.ts` Importe ergänzen:

```ts
import { getBusyWindows } from "../src/lib/repositories/calendar";
import { getForecast } from "../src/integrations/weather/openMeteo";
import { dayBounds } from "../src/lib/dates";
```

In `main()` den `planDueTasks(day)`-Aufruf ersetzen durch:

```ts
    const { start, end } = dayBounds(day);
    let busy: Awaited<ReturnType<typeof getBusyWindows>> = [];
    let forecast: Awaited<ReturnType<typeof getForecast>> = [];
    try {
      busy = await getBusyWindows(start, end);
    } catch (e) {
      console.warn("Busy-Windows konnten nicht geladen werden:", e);
    }
    try {
      forecast = await getForecast();
    } catch (e) {
      console.warn("Forecast konnte nicht geladen werden:", e);
    }

    const decisions = await planDueTasks(day, { busy, forecast });
```

> Vor dem Schreiben `src/lib/dates.ts` prüfen: `dayBounds(date): { start: Date; end: Date }` existiert (von `calendar.ts` genutzt) — Signatur bestätigen.

- [ ] **Step 6: Smoke-Run + Commit**

Run: `npm run plan:today` (im Worktree, isolierte DB)
Expected: Zeile „Verteilung für …: N fällige Tasks → …" ohne Crash.

```bash
git add src/lib/services/planning.ts src/lib/services/planning.test.ts prisma/planToday.ts
git commit -m "feat(planning): feed busy→dayLoad + forecast into planDueTasks/planToday"
```

---

### Task 7: Server-Action `syncCalendarAction` (Sync + Re-Plan + Revalidate)

**Files:**
- Create: `src/app/actions/calendar.ts`

**Interfaces:**
- Consumes: `configuredCalendars`/`syncCalendar` (Task 4), `planDueTasks` (Task 6), `getBusyWindows`/`getForecast`, `revalidateDashboard`, `dayBounds`.
- Produces: `syncCalendarAction(): Promise<{ ok: true; synced: number } | { ok: false; error: string }>` — synct, verteilt heute neu, revalidiert beide Surfaces.

- [ ] **Step 1: Action schreiben**

`src/app/actions/calendar.ts`:

```ts
"use server";

import { revalidateDashboard } from "@/lib/revalidate";
import { configuredCalendars, syncCalendar } from "@/lib/services/calendarSync";
import { planDueTasks } from "@/lib/services/planning";
import { getBusyWindows } from "@/lib/repositories/calendar";
import { getForecast } from "@/integrations/weather/openMeteo";
import { dayBounds } from "@/lib/dates";

/**
 * Synct die konfigurierten Google-Kalender, verteilt die heute fälligen,
 * offenen Aufgaben mit den frischen Terminen neu und revalidiert Tablet + Handy.
 * Fehler werden als Ergebnis zurückgegeben (kein Throw über die UI-Grenze).
 */
export async function syncCalendarAction(): Promise<
  { ok: true; synced: number } | { ok: false; error: string }
> {
  const calendars = configuredCalendars();
  if (calendars.length === 0) {
    return { ok: false, error: "Keine Kalender konfiguriert." };
  }

  try {
    const { synced } = await syncCalendar(calendars);

    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const { start, end } = dayBounds(day);
    const busy = await getBusyWindows(start, end);
    let forecast: Awaited<ReturnType<typeof getForecast>> = [];
    try {
      forecast = await getForecast();
    } catch {
      forecast = [];
    }
    await planDueTasks(day, { busy, forecast });

    revalidateDashboard();
    return { ok: true, synced };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Sync fehlgeschlagen" };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: keine Fehler in `src/app/actions/calendar.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/calendar.ts
git commit -m "feat(calendar): syncCalendarAction (sync + re-plan + revalidate)"
```

---

### Task 8: Sync-Button — `RefreshIcon` + `SyncButton`, Tablet + Handy

**Files:**
- Modify: `src/components/icons.tsx` (RefreshIcon)
- Create: `src/components/SyncButton.tsx`
- Modify: `src/components/header.tsx` (Tablet-Topbar)
- Modify: `src/components/mobile/TodayView.tsx` (Handy-PageHeader)

**Interfaces:**
- Consumes: `syncCalendarAction` (Task 7), `RefreshIcon`, `CheckIcon` (bestehend).
- Produces: `SyncButton` (Client-Komponente) mit Idle→Spinner→Haken/Fehler-Zustand; `RefreshIcon`.

- [ ] **Step 1: RefreshIcon ergänzen**

In `src/components/icons.tsx` analog zu den bestehenden Icons ergänzen (gleiche Props/`viewBox`-Konvention wie `SunIcon`/`CheckIcon` — vor dem Schreiben eine bestehende Icon-Funktion als Vorlage ansehen):

```tsx
export function RefreshIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
```

- [ ] **Step 2: SyncButton-Komponente**

`src/components/SyncButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { syncCalendarAction } from "@/app/actions/calendar";
import { RefreshIcon, CheckIcon } from "@/components/icons";

type State = "idle" | "ok" | "error";

/**
 * Kleiner Sync-Button (Tablet-Topbar & Handy-PageHeader): synct den Google-
 * Kalender, verteilt neu, revalidiert. Zeigt Spinner während des Laufs, danach
 * kurz Haken (ok) bzw. Fehler-Titel.
 */
export function SyncButton({ className = "" }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<State>("idle");

  const onClick = () =>
    startTransition(async () => {
      const result = await syncCalendarAction();
      setState(result.ok ? "ok" : "error");
      setTimeout(() => setState("idle"), 2500);
    });

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-label="Kalender synchronisieren"
      title={state === "error" ? "Sync fehlgeschlagen" : "Kalender synchronisieren"}
      className={`w-11 h-11 grid place-items-center rounded-full bg-white dark:bg-[#26241F] shadow-card text-ink-soft dark:text-cream/70 hover:scale-105 active:scale-95 transition-transform disabled:opacity-60 ${state === "error" ? "text-red-500" : ""} ${className}`}
    >
      {state === "ok" ? <CheckIcon /> : <RefreshIcon className={pending ? "w-5 h-5 animate-spin" : "w-5 h-5"} />}
    </button>
  );
}
```

> Vor dem Schreiben prüfen: `CheckIcon` akzeptiert `className`? Falls nicht, ohne Prop verwenden (`<CheckIcon />`). Tailwind-Klassen `shadow-card`/`bg-dome` etc. existieren (im Projekt genutzt).

- [ ] **Step 3: Tablet — Button in Header-Topbar**

In `src/components/header.tsx`:
- Import ergänzen: `import { SunIcon, MoonIcon } from "@/components/icons";` → zusätzlich `import { SyncButton } from "@/components/SyncButton";`
- Im rechten `div` (`flex items-center gap-2 shrink-0`) **vor** dem Dark-Mode-`<button>` einfügen:

```tsx
        <SyncButton />
```

- [ ] **Step 4: Handy — Button in PageHeader `right`-Slot**

In `src/components/mobile/TodayView.tsx`:
- Import ergänzen: `import { SyncButton } from "@/components/SyncButton";`
- `PageHeader`-Zeile ersetzen:

```tsx
      <PageHeader eyebrow="Heute im Fokus" title="Heute" right={<SyncButton />} />
```

- [ ] **Step 5: Typecheck + Build-Smoke**

Run: `npm run typecheck`
Expected: keine Fehler.

Run: `npm run lint`
Expected: keine neuen Fehler.

- [ ] **Step 6: Manueller Klick-Test (Dev-Server im Worktree)**

Run: `npm run dev` → Tablet-View `/` und Handy-View `/mobile` öffnen, Sync-Button klicken.
Expected: Spinner → Haken; Termine/Verteilung aktualisiert (oder roter Fehler-Zustand bei „nicht verbunden", ohne Crash).

- [ ] **Step 7: Commit**

```bash
git add src/components/icons.tsx src/components/SyncButton.tsx src/components/header.tsx src/components/mobile/TodayView.tsx
git commit -m "feat(ui): manual calendar sync button on tablet + mobile"
```

---

## Abschluss

- [ ] **Voller Testlauf:** `npm test` → alle grün (237 + neue).
- [ ] **Typecheck:** `npm run typecheck` → sauber.
- [ ] **Final-Review** (Cross-Cutting über den ganzen Branch) via `superpowers:requesting-code-review` — Fokus: Kapazitäts-Mathematik, Sync-Fehlerpfade, keine Prod-DB-Berührung.
- [ ] **Finishing:** `superpowers:finishing-a-development-branch` → Merge nach `main`, dann am Tablet `git pull`, `npm run build`, Neustart (`scripts/tablet-start.sh`) + einmalig Termux-Cron einhängen (Task 5 Step 6).

## Spec-Coverage-Check

- A) Auto-Sync → Task 4 (Service/Route) + Task 5 (CLI/Start/Cron). ✓
- B1) `capacity.ts` `dayLoad` → Task 2. ✓
- B2) `planTask` hart+weich+unassignable → Task 3. ✓
- B3) `selectByFairness` `loadPenalty` → Task 1. ✓
- B4) Wire-up busy+forecast → Task 6. ✓
- C) Sync-Button Handy+Tablet → Task 7 (Action) + Task 8 (UI). ✓
- Kein Schema-Change, Worktree/Prod-Trennung → Global Constraints + Abschluss. ✓
