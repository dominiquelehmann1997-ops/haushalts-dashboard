# Essensplan-Gewichtung (Feature A) — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Essensplan-Generator wählt Rezepte gewichtet (favorit ~3×, ok 1×, selten ~0,3×) statt rein zufällig und dämpft kürzlich gekochte Gerichte (Recency aus der `MealPlanEntry`-Historie) — innerhalb der unverändert harten Schicht-Constraints.

**Architecture:** Reine Gewichtungs-Funktionen (`ratingWeight`, `recencyFactor`, `weightedPick`) in einem neuen Service `mealWeights.ts` (kein DB/Next — Muster wie `freshness.ts`). Eine dünne Repository-Funktion `recentRecipeUse` liest die letzten 21 Tage aktiver `MealPlanEntry` als `Map<recipeId, daysAgo>`. `generateWeekPlan` und `rerollDraftDay` ersetzen ihren bisherigen Pick (shuffle+first bzw. Zufalls-Index) durch `weightedPick`; der injizierte `rng` treibt jetzt das Roulette-Rad und hält Tests deterministisch. Berechnet beim Lesen — es wird nichts Neues persistiert (`Recipe.rating` existiert seit Vault-V1).

**Tech Stack:** Next.js 16 (`web/`), Prisma 7 + SQLite, Vitest 4 (Test-DB-Harness `createTestClient`/`resetDatabase`, `fileParallelism: false`), TypeScript, `@/`-Alias → `src/`.

**Spec:** `docs/superpowers/specs/2026-06-10-sanftes-lernen-design.md` (Feature A). Voraussetzung Rezepte-Vault V1 ist erledigt (Felder `Recipe.rating`/`slug`/`archived` existieren, Planer filtert `archived: false`).

**Wichtige Vorab-Fakten für Implementierer:**

- Arbeitsverzeichnis für npm/npx ist `web/` (nicht Repo-Root).
- Seed-Rezepte (Test-DB nach `resetDatabase`): alphabetisch `Gemüse-Curry` (reheatable), `Ofengemüse` (reheatable), `Pasta al Pomodoro` (simple), `Pizzaabend`, `Reste` (simple+reheatable). Alle `rating: "ok"` (Default). Der Seed legt außerdem 5 **aktive** `MealPlanEntry` Mo–Fr der aktuellen Woche an — die liegen **auf/nach** dem Montag und fallen darum nie ins Recency-Fenster (`< reference`).
- **Keine Schema-Änderung** in diesem Plan — keine Migration nötig.
- Konvention: bestehender injizierter `rng: () => number` in `[0,1)`; Tests pinnen Verhalten über konstante rngs (`() => 0`, `() => 0.999`, …).

**Design-Konstanten (aus der Spec abgeleitet, im Code dokumentieren):**

- Rating-Gewichte: `favorit` → 3, `ok` → 1, `selten` → 0.3; unbekannter Wert → 1.
- Recency: Fenster 21 Tage Historie, lineare Rampe über 14 Tage (`daysAgo/14`), Untergrenze (Floor) 0.15 — ein kürzlich gekochtes Rezept ist gedämpft, aber nie unwählbar.
- Gesamtgewicht eines Rezepts = `ratingWeight(rating) · recencyFactor(daysAgo)`.

---

### Task 0: Feature-Branch

**Files:** keine (nur git)

- [ ] **Step 1: Branch anlegen**

```bash
git checkout -b feature/essensplan-gewichtung
```

---

### Task 1: Reine Gewichtungs-Funktionen `mealWeights.ts`

**Files:**
- Create: `web/src/lib/services/mealWeights.ts`
- Test: `web/src/lib/services/mealWeights.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

`web/src/lib/services/mealWeights.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  RECENCY_FLOOR,
  ratingWeight,
  recencyFactor,
  recipeWeight,
  weightedPick,
} from "./mealWeights";

interface TestRecipe {
  id: string;
  rating: string;
}
const r = (id: string, rating = "ok"): TestRecipe => ({ id, rating });

describe("ratingWeight", () => {
  it("bildet favorit/ok/selten auf 3 / 1 / 0.3 ab", () => {
    expect(ratingWeight("favorit")).toBe(3);
    expect(ratingWeight("ok")).toBe(1);
    expect(ratingWeight("selten")).toBe(0.3);
  });

  it("behandelt unbekannte Ratings wie ok (Gewicht 1)", () => {
    expect(ratingWeight("quatsch")).toBe(1);
  });
});

describe("recencyFactor", () => {
  it("ist 1 ohne kürzliche Verwendung (null)", () => {
    expect(recencyFactor(null)).toBe(1);
  });

  it("ist 1 ab 14 Tagen", () => {
    expect(recencyFactor(14)).toBe(1);
    expect(recencyFactor(21)).toBe(1);
  });

  it("steigt linear innerhalb des Fensters (7 Tage → 0.5)", () => {
    expect(recencyFactor(7)).toBeCloseTo(0.5);
  });

  it("fällt nie unter den Floor (0 oder 1 Tag → RECENCY_FLOOR)", () => {
    expect(recencyFactor(0)).toBe(RECENCY_FLOOR);
    expect(recencyFactor(1)).toBe(RECENCY_FLOOR);
  });
});

describe("recipeWeight", () => {
  it("multipliziert Rating-Gewicht und Recency-Faktor", () => {
    expect(recipeWeight("favorit", 7)).toBeCloseTo(1.5);
    expect(recipeWeight("selten", null)).toBeCloseTo(0.3);
  });
});

describe("weightedPick", () => {
  const noRecent = new Map<string, number>();

  it("liefert null für einen leeren Pool", () => {
    expect(weightedPick([], noRecent, () => 0.5)).toBeNull();
  });

  it("rng 0 wählt das erste, rng nahe 1 das letzte Element (uniforme Gewichte)", () => {
    const pool = [r("a"), r("b"), r("c")];
    expect(weightedPick(pool, noRecent, () => 0)?.id).toBe("a");
    expect(weightedPick(pool, noRecent, () => 0.999)?.id).toBe("c");
  });

  it("ein favorit unter selten gewinnt die Rad-Mitte", () => {
    // Gewichte [3, 0.3, 0.3, 0.3, 0.3] → Summe 4.2; rng 0.5 → 2.1 < 3 → favorit
    const pool = [
      r("fav", "favorit"),
      r("s1", "selten"),
      r("s2", "selten"),
      r("s3", "selten"),
      r("s4", "selten"),
    ];
    expect(weightedPick(pool, noRecent, () => 0.5)?.id).toBe("fav");
    // Gegenprobe: rng 0.95 → 3.99 → hinter Kumulativ 3.9 → letztes Element
    expect(weightedPick(pool, noRecent, () => 0.95)?.id).toBe("s4");
  });

  it("Recency dämpft ein kürzlich verwendetes Rezept", () => {
    const pool = [r("recent"), r("other")];
    const recent = new Map([["recent", 0]]); // Gewicht 0.15 statt 1
    // ohne Dämpfung: rng 0.3 → 0.6 < 1 → "recent"
    expect(weightedPick(pool, noRecent, () => 0.3)?.id).toBe("recent");
    // mit Dämpfung: Summe 1.15; rng 0.3 → 0.345 > 0.15 → "other"
    expect(weightedPick(pool, recent, () => 0.3)?.id).toBe("other");
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run (in `web/`): `npx vitest run src/lib/services/mealWeights.test.ts`
Expected: FAIL — Modul `./mealWeights` existiert nicht.

- [ ] **Step 3: Implementierung schreiben**

`web/src/lib/services/mealWeights.ts`:

```typescript
// Gewichtete Rezept-Auswahl für den Essensplan (Feature A, "sanftes Lernen").
// Reine Funktionen ohne DB/Next: Rating-Gewicht × Recency-Dämpfung treiben ein
// Roulette-Rad, der injizierte `rng` hält die Auswahl in Tests deterministisch.
// Constraints bleiben harte Filter — gewichtet wird nur INNERHALB des Pools.

/** Rating → Auswahl-Gewicht. Unbekannte Werte zählen wie "ok". */
const RATING_WEIGHTS: Record<string, number> = { favorit: 3, ok: 1, selten: 0.3 };

export function ratingWeight(rating: string): number {
  return RATING_WEIGHTS[rating] ?? 1;
}

/** Tage, über die die Recency-Dämpfung linear ausläuft. */
export const RECENCY_RAMP_DAYS = 14;
/** Untergrenze der Dämpfung — kürzlich Gekochtes bleibt wählbar, nur unwahrscheinlicher. */
export const RECENCY_FLOOR = 0.15;

/**
 * Dämpfungsfaktor aus "vor wie vielen Tagen zuletzt gekocht": `null` (nie /
 * außerhalb des Fensters) → 1; innerhalb der Rampe linear `daysAgo/14`,
 * nie unter `RECENCY_FLOOR`.
 */
export function recencyFactor(daysAgo: number | null): number {
  if (daysAgo === null || daysAgo >= RECENCY_RAMP_DAYS) return 1;
  return Math.max(RECENCY_FLOOR, daysAgo / RECENCY_RAMP_DAYS);
}

/** Gesamtgewicht eines Rezepts: Rating-Gewicht × Recency-Faktor. */
export function recipeWeight(rating: string, lastUsedDaysAgo: number | null): number {
  return ratingWeight(rating) * recencyFactor(lastUsedDaysAgo);
}

/**
 * Gewichteter Pick (Roulette-Rad) aus `pool`. `lastUsedDaysAgo` mappt
 * recipeId → Tage seit letzter aktiver Verwendung (fehlend = nie kürzlich).
 * `rng() ∈ [0,1)` injizierbar → deterministisch testbar; rng 0 wählt das
 * erste Element, rng nahe 1 das letzte. Leerer Pool → null.
 */
export function weightedPick<T extends { id: string; rating: string }>(
  pool: T[],
  lastUsedDaysAgo: Map<string, number>,
  rng: () => number,
): T | null {
  if (pool.length === 0) return null;
  const weights = pool.map((item) => recipeWeight(item.rating, lastUsedDaysAgo.get(item.id) ?? null));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let rest = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    rest -= weights[i];
    if (rest < 0) return pool[i];
  }
  return pool[pool.length - 1]; // Fließkomma-Kante (rng → 1)
}
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein**

Run (in `web/`): `npx vitest run src/lib/services/mealWeights.test.ts`
Expected: PASS (12 Tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/mealWeights.ts web/src/lib/services/mealWeights.test.ts
git commit -m "feat: mealWeights — Rating-Gewichte, Recency-Dämpfung, weightedPick (Feature A)"
```

---

### Task 2: Repository-Funktion `recentRecipeUse`

**Files:**
- Modify: `web/src/lib/repositories/meals.ts` (Import-Zeile + neue Funktion ans Dateiende)
- Test: `web/src/lib/repositories/meals.test.ts` (neuer describe-Block ans Dateiende)

- [ ] **Step 1: Failing Tests schreiben**

In `web/src/lib/repositories/meals.test.ts`: oben sicherstellen, dass `addDays` und `currentWeekBounds` aus `@/lib/dates` sowie `recentRecipeUse` aus `./meals` importiert sind (bestehende Importe ergänzen, nicht duplizieren). Dann ans Dateiende (innerhalb keiner anderen describe) anhängen — der Block nutzt dieselben `client`-Harness-Muster wie der bestehende `listRecipes`-Block (eigenes `let client` + `beforeEach`/`afterAll`, falls der bestehende Block nicht erweiterbar ist; bevorzugt den vorhandenen Test-Setup des Files wiederverwenden):

```typescript
describe("recentRecipeUse", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("mappt jedes Rezept auf die Tage seit der jüngsten aktiven Verwendung vor der Referenz", async () => {
    const { start: monday } = currentWeekBounds();
    const recipes = await client.recipe.findMany({ orderBy: { name: "asc" } });

    // zwei Verwendungen desselben Rezepts: die jüngste (vor 3 Tagen) zählt
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -10), recipeId: recipes[0].id, status: "active" },
    });
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -3), recipeId: recipes[0].id, status: "active" },
    });
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -7), recipeId: recipes[1].id, status: "active" },
    });

    const map = await recentRecipeUse(monday, client);
    expect(map.get(recipes[0].id)).toBe(3);
    expect(map.get(recipes[1].id)).toBe(7);
  });

  it("ignoriert Entwürfe, Einträge ab der Referenz und Einträge älter als 21 Tage", async () => {
    const { start: monday } = currentWeekBounds();
    const recipes = await client.recipe.findMany({ orderBy: { name: "asc" } });

    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -5), recipeId: recipes[0].id, status: "draft" },
    });
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -30), recipeId: recipes[1].id, status: "active" },
    });

    const map = await recentRecipeUse(monday, client);
    expect(map.has(recipes[0].id)).toBe(false);
    expect(map.has(recipes[1].id)).toBe(false);
    // die geseedeten aktiven Einträge der Woche liegen AUF/NACH dem Montag → zählen nicht
    expect(map.size).toBe(0);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run (in `web/`): `npx vitest run src/lib/repositories/meals.test.ts`
Expected: FAIL — `recentRecipeUse` wird nicht exportiert.

- [ ] **Step 3: Implementierung schreiben**

In `web/src/lib/repositories/meals.ts`: die Import-Zeile von `@/lib/dates` um `addDays` ergänzen:

```typescript
import { addDays, currentWeekBounds, localDateKey, mondayOf } from "@/lib/dates";
```

Ans Dateiende:

```typescript
/**
 * Tage seit der letzten AKTIVEN Verwendung je Rezept, gemessen an `reference`
 * (exklusiv) über die letzten `windowDays` Tage — Grundlage der Recency-
 * Dämpfung der Essensplan-Gewichtung (Feature A). Entwürfe zählen nicht;
 * fehlt ein Rezept in der Map, wurde es im Fenster nicht gekocht.
 */
export async function recentRecipeUse(
  reference: Date,
  client: PrismaClient = prisma,
  windowDays = 21,
): Promise<Map<string, number>> {
  const from = addDays(reference, -windowDays);
  const rows = await client.mealPlanEntry.findMany({
    where: { status: "active", date: { gte: from, lt: reference } },
    orderBy: { date: "desc" },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (map.has(row.recipeId)) continue; // desc sortiert → jüngste Verwendung gewinnt
    // round statt floor: robust gegen DST-bedingte 23/25-Stunden-Tage
    map.set(row.recipeId, Math.round((reference.getTime() - row.date.getTime()) / 86_400_000));
  }
  return map;
}
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein**

Run (in `web/`): `npx vitest run src/lib/repositories/meals.test.ts`
Expected: PASS (bestehende + 2 neue Tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/repositories/meals.ts web/src/lib/repositories/meals.test.ts
git commit -m "feat: recentRecipeUse — letzte aktive Rezept-Verwendung als daysAgo-Map"
```

---

### Task 3: `generateWeekPlan` wählt gewichtet

**Files:**
- Modify: `web/src/lib/services/mealPlanner.ts` (shuffle raus, weightedPick + Recency rein)
- Modify: `web/src/lib/services/mealPlanner.test.ts` (1 Test umstellen, 2 neue Tests, Kommentare aktualisieren)

**Kontext:** Bisher shuffelt `generateWeekPlan` die Rezepte (Fisher–Yates über `rng`), sortiert für `preferSimple` simple-first und nimmt pro Tag das erste noch-nicht-benutzte Pool-Element. Neu: kein Shuffle/Sort mehr — `candidatesFor` filtert wie bisher hart (inkl. `preferSimple`-Filter und Leerer-Pool-Fallback auf `base`), der Pick im Pool kommt aus `weightedPick`. Der `rng` treibt jetzt das Rad: `() => 0` wählt das erste, `() => 0.999` das letzte Pool-Element.

- [ ] **Step 1: Bestehenden Test umstellen + neue failing Tests schreiben**

In `web/src/lib/services/mealPlanner.test.ts` (erster describe-Block "mealPlanner service"):

1. Den Kommentar über `identityRng` (Zeilen über `const identityRng = () => 0.999;`) ersetzen durch:

```typescript
  // Mit weightedPick wählt rng→0.999 stets das LETZTE Element des Tages-Pools
  // (Rad-Ende) und rng→0 das ERSTE — beides pinnt die Auswahl deterministisch.
  const identityRng = () => 0.999;
  const zeroRng = () => 0;
```

2. Den Test `"generateWeekPlan({preferSimple: false}) with identity rng orders by name — Monday is alphabetically first"` ersetzen durch:

```typescript
  it("generateWeekPlan({preferSimple: false}) mit zero rng wählt für Montag das alphabetisch erste Rezept", async () => {
    const today = new Date();
    const entries = await generateWeekPlan(today, { preferSimple: false }, client, zeroRng);

    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const monday = sorted[0];
    const mondayRecipe = await client.recipe.findUniqueOrThrow({ where: { id: monday.recipeId } });

    const allRecipes = await client.recipe.findMany({ orderBy: { name: "asc" } });
    expect(mondayRecipe.name).toBe(allRecipes[0].name);
  });
```

3. Im Test `"varies the day→recipe assignment with the injected rng"` den Binnen-Kommentar anpassen (Verhalten bleibt: identityRng vs `() => 0` müssen unterschiedliche Tages-Reihenfolgen liefern):

```typescript
    // identityRng (~1) wählt je Tag das letzte, () => 0 das erste Pool-Element —
    // die beiden Tages-Reihenfolgen müssen sich unterscheiden.
```

4. Zwei neue Tests ans Ende des ersten describe-Blocks:

```typescript
  it("gewichtet favorit-Rezepte höher (deterministisch über rng)", async () => {
    // Erstes Rezept (alphabetisch) → favorit, Rest → selten: Gewichte [3, .3, .3, .3, .3]
    await client.recipe.updateMany({ data: { rating: "selten" } });
    const all = await client.recipe.findMany({ orderBy: { name: "asc" } });
    await client.recipe.update({ where: { id: all[0].id }, data: { rating: "favorit" } });

    // rng 0.5 → 0.5 · 4.2 = 2.1 < 3 → das favorit-Rezept gewinnt den Montag
    const entries = await generateWeekPlan(new Date(), { preferSimple: false }, client, () => 0.5);
    const monday = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    expect(monday.recipeId).toBe(all[0].id);

    // Gegenprobe: rng 0.95 → 3.99 → fällt ans Rad-Ende → NICHT das favorit-Rezept
    const entries2 = await generateWeekPlan(new Date(), { preferSimple: false }, client, () => 0.95);
    const monday2 = [...entries2].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    expect(monday2.recipeId).not.toBe(all[0].id);
  });

  it("dämpft kürzlich gekochte Rezepte (Recency aus aktiver Historie)", async () => {
    const { start: monday } = currentWeekBounds();
    const all = await client.recipe.findMany({ orderBy: { name: "asc" } });

    // Ohne Historie: alle Gewichte 1, rng 0.1 → 0.5 < 1 → alphabetisch erstes Rezept
    const before = await generateWeekPlan(new Date(), { preferSimple: false }, client, () => 0.1);
    const beforeMonday = [...before].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    expect(beforeMonday.recipeId).toBe(all[0].id);

    // Erstes Rezept vor 2 Tagen aktiv gekocht → Gewicht 0.15 (Floor):
    // Summe 4.15, rng 0.1 → 0.415 > 0.15 → das ZWEITE Rezept gewinnt den Montag
    await client.mealPlanEntry.create({
      data: { date: addDays(monday, -2), recipeId: all[0].id, status: "active" },
    });
    const after = await generateWeekPlan(new Date(), { preferSimple: false }, client, () => 0.1);
    const afterMonday = [...after].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    expect(afterMonday.recipeId).toBe(all[1].id);
  });
```

5. Den Import oben ergänzen: `import { addDays, currentWeekBounds } from "@/lib/dates";` (statt nur `currentWeekBounds`).

- [ ] **Step 2: Tests laufen lassen — die neuen/umgestellten müssen fehlschlagen**

Run (in `web/`): `npx vitest run src/lib/services/mealPlanner.test.ts`
Expected: FAIL — alter Pick-Mechanismus (shuffle+first) erfüllt die rng-Pinnings nicht.

- [ ] **Step 3: `mealPlanner.ts` umbauen**

1. Imports anpassen — `shuffle` entfällt, neu:

```typescript
import { weightedPick } from "./mealWeights";
import { recentRecipeUse } from "@/lib/repositories/meals";
```

2. Die Funktion `shuffle` (inkl. Doc-Kommentar) komplett löschen.

3. Datei-Kopfkommentar (Zeilen 1–4) ergänzen um den Satz:

```typescript
// Innerhalb des erlaubten Pools wählt ein gewichtetes Roulette-Rad
// (Rating favorit/ok/selten + Recency-Dämpfung, s. mealWeights.ts).
```

4. In `generateWeekPlan` den Doc-Kommentar-Absatz „Within the pool, the first not-yet-used recipe wins …" ersetzen durch:

```typescript
 * Within the pool, a weighted roulette pick chooses the recipe: rating weights
 * (favorit 3× / ok 1× / selten 0.3×) times a recency damping for dishes cooked
 * in the last ~14 days (active history, see `recentRecipeUse`). Not-yet-used
 * recipes are preferred for variety. `rng` drives the wheel — injecting it
 * keeps tests deterministic.
```

5. Den Body umbauen — aus:

```typescript
  // Freshness: shuffle once; for preferSimple, stable-sort simple recipes first.
  let base = shuffle(recipes, rng);
  if (opts.preferSimple) {
    base = [...base].sort((a, b) => (a.simple === b.simple ? 0 : a.simple ? -1 : 1));
  }
```

wird (Shuffle/Sort ersatzlos — `candidatesFor` filtert `preferSimple` bereits hart):

```typescript
  // Recency-Dämpfung: was in den 21 Tagen VOR dieser Woche aktiv gekocht wurde.
  const recent = await recentRecipeUse(monday, client);
```

6. In der Tages-Schleife den Pick ersetzen — aus:

```typescript
    const pool = candidatesFor(c, base, opts.preferSimple);
    const fresh = pool.filter((r) => !used.has(r.id));
    const pick = (fresh.length > 0 ? fresh : pool)[0];
```

wird:

```typescript
    const pool = candidatesFor(c, recipes, opts.preferSimple);
    const fresh = pool.filter((r) => !used.has(r.id));
    // Pool ist nie leer (recipes.length > 0 + base-Fallback in candidatesFor) → `!` sicher.
    const pick = weightedPick(fresh.length > 0 ? fresh : pool, recent, rng)!;
```

- [ ] **Step 4: Tests laufen lassen — alle mealPlanner-Tests müssen grün sein**

Run (in `web/`): `npx vitest run src/lib/services/mealPlanner.test.ts`
Expected: PASS (alle bestehenden + 2 neue). Hinweis: die dienstbewussten Tests bleiben unverändert gültig (sie asserten Eigenschaften wie `simple`/`reheatable`/`reason`, nicht konkrete Namen — außer „Reste", das als einziges simple+reheatable-Rezept ein Ein-Element-Pool ist).

- [ ] **Step 5: Gesamte Suite laufen lassen (Schutz gegen Folgebrüche, z.B. mealDraft)**

Run (in `web/`): `npm test`
Expected: PASS. Falls `mealDraft.test.ts` o.ä. bricht: NICHT hier fixen, Task 4 stellt `rerollDraftDay` um — nur prüfen, ob der Bruch von Task-3-Änderungen an `candidatesFor`-Aufrufen kommt (sollte nicht, Signatur unverändert).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/services/mealPlanner.ts web/src/lib/services/mealPlanner.test.ts
git commit -m "feat: generateWeekPlan wählt gewichtet (Rating + Recency) statt shuffle+first"
```

---

### Task 4: `rerollDraftDay` würfelt gewichtet

**Files:**
- Modify: `web/src/lib/services/mealDraft.ts` (Zufalls-Index → weightedPick + Recency)
- Modify: `web/src/lib/services/mealDraft.test.ts` (1 neuer Test)

- [ ] **Step 1: Failing Test schreiben**

In `web/src/lib/services/mealDraft.test.ts`, in den describe-Block mit den `rerollDraftDay`-Tests, nach dem Test `"rerollDraftDay on a needsSimple day still picks a simple recipe"`:

```typescript
  it("rerollDraftDay würfelt gewichtet (favorit gewinnt die Rad-Mitte)", async () => {
    await generateWeekPlan(new Date(), { preferSimple: false }, client);
    const monday = await draftMondayEntry();

    // Das aktuelle Montags-Rezept ist ausgeschlossen; unter den übrigen vier
    // (alphabetisch) wird das zweite favorit, der Rest selten:
    // Gewichte [0.3, 3, 0.3, 0.3] → Summe 3.9; rng 0.6 → 2.34 → kumulativ
    // [0.3, 3.3, …] → favorit gewinnt. (Alter Zufalls-Index hätte
    // choices[Math.floor(0.6·4)] = choices[2] gewählt — der Test
    // unterscheidet also wirklich alten und neuen Mechanismus.)
    const others = await client.recipe.findMany({
      where: { id: { not: monday.recipeId } },
      orderBy: { name: "asc" },
    });
    await client.recipe.updateMany({ data: { rating: "selten" } });
    await client.recipe.update({ where: { id: others[1].id }, data: { rating: "favorit" } });

    const updated = await rerollDraftDay(monday.date, false, client, () => 0.6);
    expect(updated!.recipeId).toBe(others[1].id);
  });
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run (in `web/`): `npx vitest run src/lib/services/mealDraft.test.ts`
Expected: FAIL — der alte Code wählt `choices[Math.floor(0.6 · 4)] = others[2]`, der Test erwartet `others[1]`.

- [ ] **Step 3: `mealDraft.ts` umbauen**

1. Imports ergänzen:

```typescript
import { weightedPick } from "./mealWeights";
import { recentRecipeUse } from "@/lib/repositories/meals";
```

2. In `rerollDraftDay` den Pick ersetzen — aus:

```typescript
  const pool = candidatesFor(constraint, recipes, preferSimple);
  const others = pool.filter((r) => r.id !== entry.recipeId);
  const choices = others.length > 0 ? others : pool;
  const pick = choices[Math.floor(rng() * choices.length)];
```

wird:

```typescript
  const pool = candidatesFor(constraint, recipes, preferSimple);
  const others = pool.filter((r) => r.id !== entry.recipeId);
  const choices = others.length > 0 ? others : pool;
  // Gewichteter Pick wie im Planer (Rating + Recency); choices ist nie leer
  // (recipes.length > 0 + base-Fallback in candidatesFor) → `!` sicher.
  const recent = await recentRecipeUse(weekBoundsOf(entry.date).start, client);
  const pick = weightedPick(choices, recent, rng)!;
```

3. Den Doc-Kommentar von `rerollDraftDay` („Würfelt das Rezept … schließt das aktuelle Rezept möglichst aus.") um einen Satz ergänzen:

```typescript
 * Der Pick ist gewichtet wie im Planer (Rating favorit/ok/selten + Recency).
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein**

Run (in `web/`): `npx vitest run src/lib/services/mealDraft.test.ts`
Expected: PASS — auch die bestehenden Tests (sie nutzen `zeroRng` → erstes Element, das bleibt unter weightedPick identisch).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/mealDraft.ts web/src/lib/services/mealDraft.test.ts
git commit -m "feat: rerollDraftDay würfelt gewichtet (Rating + Recency) wie der Planer"
```

---

### Task 5: Doku + Abschluss-Verifikation

**Files:**
- Modify: `web/README.md` (Transparenz-Absatz im Abschnitt „Rezepte-Vault")

- [ ] **Step 1: README ergänzen**

In `web/README.md`, ans Ende des Abschnitts `## Rezepte-Vault`:

```markdown
### Gewichtete Essensplan-Auswahl

Das Frontmatter-`rating` steuert, wie oft ein Rezept im Wochenplan landet:
`favorit` ≈ 3×, `ok` 1×, `selten` ≈ 0,3× Wahrscheinlichkeit — innerhalb der
harten Dienstplan-Constraints. Zusätzlich werden Gerichte gedämpft, die in den
letzten ~14 Tagen schon im aktiven Plan standen (nie ganz ausgeschlossen).
Ohne Bewertungen/Historie verhält sich der Planer wie vorher (Fallback).
```

- [ ] **Step 2: Gesamte Suite + Typecheck + Lint**

Run (in `web/`):

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: Suite PASS (189 Bestand + ~17 neue), Typecheck ohne Fehler, Lint clean.

- [ ] **Step 3: Commit**

```bash
git add web/README.md
git commit -m "docs: gewichtete Essensplan-Auswahl im README erklärt"
```
