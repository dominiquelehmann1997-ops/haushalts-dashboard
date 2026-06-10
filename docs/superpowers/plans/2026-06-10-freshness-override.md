# Haltbarkeits-Korrektur-Gedächtnis (FreshnessOverride) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Falsche Haltbarkeits-Einstufungen (z.B. „Kokosmilch" → fälschlich „frisch") werden einmal am Einkaufs-Item korrigiert und ab dann dauerhaft gemerkt — Auflösungsreihenfolge Frontmatter → gelernter Override → Keyword-Heuristik.

**Architecture:** Neue Tabelle `FreshnessOverride` (normalisierter Name → frisch/haltbar) als einzige Persistenz; eine reine Funktion `resolveFreshness(name, overrides)` deckt Override→Heuristik ab, die Frontmatter-Stufe ist das vorhandene `Ingredient.category` (non-null = explizite Angabe). Integration an den zwei bestehenden Lesepfaden (`syncIngredientsToShopping`, `getFreshShoppingState`); ein Toggle-Badge am Einkaufs-Item schreibt den Override und flippt das Item sofort.

**Tech Stack:** Next.js 16 (`web/`), Prisma 7 + SQLite, Vitest 4 (Test-Harness `createTestClient`/`resetDatabase`), `@/`-Alias → `web/src/`.

**Spec:** `docs/superpowers/specs/2026-06-10-sanftes-lernen-design.md`, Abschnitt C1.

---

## Wichtige Umgebungs-Hinweise (für jeden Task)

- **Alle npm/npx-Befehle in `web\` ausführen**, nicht im Repo-Root.
- Shell ist **PowerShell 5.1**: kein `&&` — `;` oder `if ($?) { … }` nutzen.
- Nach `npx prisma migrate dev` regeneriert sich der Client hier NICHT zuverlässig — **immer danach** `node node_modules/prisma/build/index.js generate` ausführen (in `web\`). `web/src/generated` ist gitignored.
- Jede Commit-Message endet mit Leerzeile + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (z.B. via zweitem `-m`-Flag).
- Branch: `feature/freshness-override` (Task 0), Basis `main`.

## Design-Entscheidung: `Ingredient.category` = nur noch explizite Angabe

Die Spec-Reihenfolge ist **Frontmatter → Override → Heuristik**. „Frontmatter" heißt: `Ingredient.category` ist non-null (der Vault-Ingest schreibt es nur bei explizitem `freshness`-Frontmatter, sonst null — siehe `recipeVault.ts:16`). Der **Seed** befüllt `category` heute aber per `classifyFreshness` vor (`prisma/seed.ts:311`) — damit würde die vorbelegte Heuristik-Kategorie jeden Override schlagen und z.B. Kokosmilch wäre unkorrigierbar. Task 1 stellt den Seed auf `category: null` um. **Verhalten ändert sich dadurch nicht**, weil beide Lesepfade (`shoppingSync.ts:44`, `shopping.ts:62`) bereits `?? classifyFreshness(name)` als Fallback haben.

## File Structure

| Datei | Verantwortung |
|---|---|
| `web/prisma/schema.prisma` | Neues Model `FreshnessOverride`; Kommentar an `Ingredient.category` präzisieren |
| `web/prisma/seed.ts` | Wipe um `freshnessOverride` ergänzen; Ingredient-Seeds auf `category: null` |
| `web/src/lib/services/freshness.ts` | Reine Funktionen `normalizeIngredientName`, `resolveFreshness` (neben bestehendem `classifyFreshness`) |
| `web/src/lib/repositories/freshnessOverride.ts` (neu) | DB-Zugriff: `getFreshnessOverrides` (Map fürs Lesen), `toggleItemFreshness` (Korrektur schreiben) |
| `web/src/lib/services/shoppingSync.ts` | Kategorie-Auflösung beim Sync nutzt Overrides |
| `web/src/lib/repositories/shopping.ts` | `getFreshShoppingState`-Zutaten-Scan nutzt Overrides; `getShoppingItems` liefert `category` mit |
| `web/src/lib/data.ts` | `ShoppingItem`-DTO um `category` erweitert |
| `web/src/app/actions/shopping.ts` | `toggleFreshnessAction` |
| `web/src/components/widgets.tsx` | Toggle-Badge im `ShoppingWidget` |
| `web/src/components/dashboard.tsx` | Handler durchreichen |
| `web/README.md` | Doku-Absatz |

---

### Task 0: Feature-Branch

- [ ] **Step 1: Branch anlegen**

```bash
git checkout main
git checkout -b feature/freshness-override
```

Expected: `Switched to a new branch 'feature/freshness-override'`.

---

### Task 1: Schema, Migration, Seed-Anpassung

**Files:**
- Modify: `web/prisma/schema.prisma`
- Modify: `web/prisma/seed.ts`

- [ ] **Step 1: Schema erweitern**

In `web/prisma/schema.prisma` das Kommentar der `Ingredient.category`-Zeile ersetzen — aus:

```prisma
  category String? // "frisch" | "haltbar" (per classifyFreshness vorbelegt)
```

wird:

```prisma
  category String? // "frisch" | "haltbar" — explizite Angabe (Vault-Frontmatter); null → Override/Heuristik beim Lesen
```

Und ans Dateiende (nach dem `OAuthToken`-Model) das neue Model anhängen:

```prisma
/// Gelernte Haltbarkeits-Korrektur (Sanftes Lernen C1): einmal am Einkaufs-Item
/// korrigiert, gilt der Wert für jedes künftige Auftauchen der Zutat.
model FreshnessOverride {
  id        String @id @default(cuid())
  name      String @unique // normalisierter Zutatenname (trim + lowercase)
  freshness String // "frisch" | "haltbar"
}
```

- [ ] **Step 2: Migration + Client-Generate**

Run (in `web\`):

```bash
npx prisma migrate dev --name freshness_override
node node_modules/prisma/build/index.js generate
```

Expected: neue Migration `*_freshness_override` unter `web/prisma/migrations/`, Generate ohne Fehler.

- [ ] **Step 3: Seed anpassen**

In `web/prisma/seed.ts` drei Änderungen:

(a) Import entfernen (Zeile 8):

```typescript
import { classifyFreshness } from "../src/lib/services/freshness";
```

→ Zeile löschen.

(b) Im Wipe-Block (nach `await prisma.shoppingItem.deleteMany();`) ergänzen:

```typescript
  await prisma.freshnessOverride.deleteMany();
```

(c) Beim Ingredient-Anlegen (`prisma.ingredient.create`, ca. Zeile 305–313) die Kategorie auf null stellen — aus:

```typescript
          category: classifyFreshness(ingredient.name),
```

wird:

```typescript
          // null = keine explizite Angabe → Haltbarkeit wird beim Lesen aus
          // Override/Heuristik aufgelöst (Sanftes Lernen C1).
          category: null,
```

- [ ] **Step 4: Suite läuft unverändert grün**

Run (in `web\`): `npm test`

Expected: **205 passed** — keine Verhaltensänderung, weil alle Lesepfade den `?? classifyFreshness(...)`-Fallback haben.

- [ ] **Step 5: Commit**

```bash
git add web/prisma/schema.prisma web/prisma/seed.ts web/prisma/migrations
git commit -m "feat: FreshnessOverride-Tabelle; Ingredient.category nur noch explizite Angabe"
```

---

### Task 2: Reine Funktionen `normalizeIngredientName` + `resolveFreshness`

**Files:**
- Modify: `web/src/lib/services/freshness.ts`
- Test: `web/src/lib/services/freshness.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

In `web/src/lib/services/freshness.test.ts` den Import erweitern und zwei describes anhängen:

```typescript
import {
  classifyFreshness,
  normalizeIngredientName,
  resolveFreshness,
  suggestFreshShoppingDay,
  type Freshness,
} from "./freshness";
```

Ans Dateiende:

```typescript
describe("normalizeIngredientName", () => {
  it("trimmt und lowercased", () => {
    expect(normalizeIngredientName("  Kokosmilch ")).toBe("kokosmilch");
    expect(normalizeIngredientName("TOMATEN")).toBe("tomaten");
  });
});

describe("resolveFreshness", () => {
  it("nutzt den gelernten Override (normalisierter Lookup)", () => {
    const overrides = new Map<string, Freshness>([["kokosmilch", "haltbar"]]);
    expect(resolveFreshness("Kokosmilch", overrides)).toBe("haltbar");
    expect(resolveFreshness("  KOKOSMILCH  ", overrides)).toBe("haltbar");
  });

  it("fällt ohne Override auf die Keyword-Heuristik zurück", () => {
    expect(resolveFreshness("Kokosmilch", new Map())).toBe("frisch"); // "milch"-Keyword greift fälschlich
    expect(resolveFreshness("Nudeln", new Map())).toBe("haltbar");
  });

  it("kann auch in Richtung frisch korrigieren", () => {
    const overrides = new Map<string, Freshness>([["nudeln", "frisch"]]);
    expect(resolveFreshness("Nudeln", overrides)).toBe("frisch");
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run (in `web\`): `npx vitest run src/lib/services/freshness.test.ts`

Expected: FAIL — `normalizeIngredientName`/`resolveFreshness` existieren nicht.

- [ ] **Step 3: Implementierung**

In `web/src/lib/services/freshness.ts` nach `classifyFreshness` anfügen:

```typescript
/** Normalisierter Zutatenname als Schlüssel für Overrides: trim + lowercase. */
export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Haltbarkeit mit Korrektur-Gedächtnis (Sanftes Lernen C1): ein gelernter
 * Override (Map normalisierter Name → Frische) schlägt die Keyword-Heuristik.
 * Die Frontmatter-Stufe davor liegt beim Aufrufer (`Ingredient.category`).
 */
export function resolveFreshness(name: string, overrides: Map<string, Freshness>): Freshness {
  return overrides.get(normalizeIngredientName(name)) ?? classifyFreshness(name);
}
```

- [ ] **Step 4: Tests laufen lassen — grün**

Run (in `web\`): `npx vitest run src/lib/services/freshness.test.ts`

Expected: PASS (4 neue Tests, 9 gesamt in der Datei).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/freshness.ts web/src/lib/services/freshness.test.ts
git commit -m "feat: resolveFreshness — gelernter Override schlägt Heuristik"
```

---

### Task 3: Repository `freshnessOverride.ts` (Lesen + Toggle)

**Files:**
- Create: `web/src/lib/repositories/freshnessOverride.ts`
- Test: `web/src/lib/repositories/freshnessOverride.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

`web/src/lib/repositories/freshnessOverride.test.ts` anlegen:

```typescript
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getFreshnessOverrides, toggleItemFreshness } from "./freshnessOverride";

describe("freshnessOverride repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("toggleItemFreshness flippt das Item und upserted den normalisierten Override", async () => {
    const item = await client.shoppingItem.create({
      data: { text: "Kokosmilch", meal: true, source: "recipe", category: "frisch" },
    });

    const next = await toggleItemFreshness(item.id, client);

    expect(next).toBe("haltbar");
    const updated = await client.shoppingItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.category).toBe("haltbar");
    const override = await client.freshnessOverride.findUniqueOrThrow({
      where: { name: "kokosmilch" },
    });
    expect(override.freshness).toBe("haltbar");
  });

  it("ein zweiter Toggle flippt zurück und aktualisiert dieselbe Override-Zeile", async () => {
    const item = await client.shoppingItem.create({
      data: { text: "Kokosmilch", meal: true, source: "recipe", category: "frisch" },
    });

    await toggleItemFreshness(item.id, client);
    const next = await toggleItemFreshness(item.id, client);

    expect(next).toBe("frisch");
    expect(await client.freshnessOverride.count()).toBe(1);
    const override = await client.freshnessOverride.findUniqueOrThrow({
      where: { name: "kokosmilch" },
    });
    expect(override.freshness).toBe("frisch");
  });

  it("ignoriert manuelle Items und Rezept-Items ohne Kategorie", async () => {
    // Seed: "Brot" ist manuell; "Tomaten" ist source "recipe", aber category null.
    const manual = await client.shoppingItem.findFirstOrThrow({ where: { text: "Brot" } });
    const uncategorized = await client.shoppingItem.findFirstOrThrow({
      where: { text: "Tomaten", source: "recipe" },
    });

    expect(await toggleItemFreshness(manual.id, client)).toBeNull();
    expect(await toggleItemFreshness(uncategorized.id, client)).toBeNull();
    expect(await client.freshnessOverride.count()).toBe(0);
  });

  it("getFreshnessOverrides liefert die Name→Frische-Map", async () => {
    await client.freshnessOverride.create({ data: { name: "kokosmilch", freshness: "haltbar" } });
    await client.freshnessOverride.create({ data: { name: "feta", freshness: "frisch" } });

    const map = await getFreshnessOverrides(client);

    expect(map.get("kokosmilch")).toBe("haltbar");
    expect(map.get("feta")).toBe("frisch");
    expect(map.size).toBe(2);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run (in `web\`): `npx vitest run src/lib/repositories/freshnessOverride.test.ts`

Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementierung**

`web/src/lib/repositories/freshnessOverride.ts` anlegen:

```typescript
// Repository für das Haltbarkeits-Korrektur-Gedächtnis (Sanftes Lernen C1):
// liest alle Overrides als Map fürs Auflösen beim Lesen und schreibt eine
// Korrektur (Toggle am Einkaufs-Item → Override + sofortiges Item-Update).

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { normalizeIngredientName, type Freshness } from "@/lib/services/freshness";

/** Alle gelernten Overrides als Map: normalisierter Name → "frisch" | "haltbar". */
export async function getFreshnessOverrides(
  client: PrismaClient = prisma,
): Promise<Map<string, Freshness>> {
  const rows = await client.freshnessOverride.findMany();
  return new Map(rows.map((r) => [r.name, r.freshness === "frisch" ? "frisch" : "haltbar"]));
}

/**
 * Korrigiert die Haltbarkeit eines Rezept-Einkaufs-Items: flippt dessen
 * `category`, upserted den Override unter dem normalisierten Namen und liefert
 * den neuen Wert. `null` (no-op) für manuelle Items oder Items ohne Kategorie.
 */
export async function toggleItemFreshness(
  itemId: string,
  client: PrismaClient = prisma,
): Promise<Freshness | null> {
  const item = await client.shoppingItem.findUnique({ where: { id: itemId } });
  if (
    !item ||
    item.source !== "recipe" ||
    (item.category !== "frisch" && item.category !== "haltbar")
  ) {
    return null;
  }

  const next: Freshness = item.category === "frisch" ? "haltbar" : "frisch";
  const name = normalizeIngredientName(item.text);

  await client.freshnessOverride.upsert({
    where: { name },
    create: { name, freshness: next },
    update: { freshness: next },
  });
  await client.shoppingItem.update({ where: { id: itemId }, data: { category: next } });

  return next;
}
```

- [ ] **Step 4: Tests laufen lassen — grün**

Run (in `web\`): `npx vitest run src/lib/repositories/freshnessOverride.test.ts`

Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/repositories/freshnessOverride.ts web/src/lib/repositories/freshnessOverride.test.ts
git commit -m "feat: FreshnessOverride-Repository (Map-Lesen + Item-Toggle)"
```

---

### Task 4: Lesepfade nutzen die Overrides (Sync + Frisch-Vorschlag)

**Files:**
- Modify: `web/src/lib/services/shoppingSync.ts`
- Modify: `web/src/lib/repositories/shopping.ts` (nur `getFreshShoppingState`)
- Test: `web/src/lib/services/shoppingSync.test.ts`, `web/src/lib/repositories/shopping.test.ts`

- [ ] **Step 1: Failing Tests schreiben — Sync**

In `web/src/lib/services/shoppingSync.test.ts` ans Ende des bestehenden `describe("shoppingSync service")` zwei Tests anhängen. (Hinweis: das `beforeEach` generiert den Plan neu; „Tomaten"/„Nudeln" sind laut bestehender Tests garantiert dabei — deshalb diese Zutaten statt Kokosmilch.)

```typescript
  it("wendet gelernte Haltbarkeits-Korrekturen an (Override schlägt Heuristik)", async () => {
    await client.freshnessOverride.create({ data: { name: "tomaten", freshness: "haltbar" } });

    await syncIngredientsToShopping(client);

    const tomaten = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Tomaten" },
    });
    expect(tomaten.category).toBe("haltbar");
  });

  it("explizite Angabe (Ingredient.category) schlägt den Override", async () => {
    await client.ingredient.updateMany({ where: { name: "Nudeln" }, data: { category: "frisch" } });
    await client.freshnessOverride.create({ data: { name: "nudeln", freshness: "haltbar" } });

    await syncIngredientsToShopping(client);

    const nudeln = await client.shoppingItem.findFirstOrThrow({
      where: { source: "recipe", text: "Nudeln" },
    });
    expect(nudeln.category).toBe("frisch");
  });
```

- [ ] **Step 2: Failing Test schreiben — Frisch-Vorschlag**

In `web/src/lib/repositories/shopping.test.ts` ans Ende des bestehenden `describe("getFreshShoppingState")` anhängen. (Seed-Plan: Mo Pasta al Pomodoro — Frisch-Zutaten Tomaten + Basilikum; Di Gemüse-Curry — Kokosmilch gilt der Heuristik als frisch.)

```typescript
  it("Overrides verschieben den Vorschlagstag (Mo-Zutaten haltbar → frühester Frisch-Tag Di)", async () => {
    await client.freshnessOverride.create({ data: { name: "tomaten", freshness: "haltbar" } });
    await client.freshnessOverride.create({ data: { name: "basilikum", freshness: "haltbar" } });
    // Sync neu laufen lassen, damit die Items die korrigierte Kategorie tragen.
    await syncIngredientsToShopping(client);

    const state = await getFreshShoppingState(client);

    expect(state.pendingItems).not.toContain("Tomaten");
    expect(state.pendingItems).toContain("Kokosmilch");
    // Frühester Frisch-Verbrauch ist jetzt Dienstag (Kokosmilch) → Vorschlag Montag.
    const { start } = currentWeekBounds();
    expect(state.suggestedDayISO).toBe(new Date(start).toISOString());
  });
```

- [ ] **Step 3: Tests laufen lassen — die drei neuen müssen fehlschlagen**

Run (in `web\`): `npx vitest run src/lib/services/shoppingSync.test.ts src/lib/repositories/shopping.test.ts`

Expected: 3 FAIL (Overrides werden noch ignoriert), Bestand grün.

- [ ] **Step 4: Sync-Integration**

In `web/src/lib/services/shoppingSync.ts`:

Import-Block ändern — aus:

```typescript
import { classifyFreshness } from "@/lib/services/freshness";
```

wird:

```typescript
import { resolveFreshness } from "@/lib/services/freshness";
import { getFreshnessOverrides } from "@/lib/repositories/freshnessOverride";
```

Im Funktionskörper von `syncIngredientsToShopping` direkt nach der `entries`-Query die Overrides laden und die Kategorie-Zeile umstellen — aus:

```typescript
          category: ingredient.category ?? classifyFreshness(ingredient.name),
```

wird (mit der neuen Zeile davor, auf Funktionsebene nach `const entries = …;`):

```typescript
  const overrides = await getFreshnessOverrides(client);
```

```typescript
          category: ingredient.category ?? resolveFreshness(ingredient.name, overrides),
```

Im JSDoc der Funktion den Klammerzusatz aktualisieren — aus „(from `Ingredient.category`, falling back to `classifyFreshness`)" wird „(from `Ingredient.category`, falling back to a learned override, then `classifyFreshness`)".

- [ ] **Step 5: Frisch-Vorschlag-Integration**

In `web/src/lib/repositories/shopping.ts`:

Import-Zeile ändern — aus:

```typescript
import { classifyFreshness, suggestFreshShoppingDay } from "@/lib/services/freshness";
```

wird:

```typescript
import { resolveFreshness, suggestFreshShoppingDay } from "@/lib/services/freshness";
import { getFreshnessOverrides } from "@/lib/repositories/freshnessOverride";
```

In `getFreshShoppingState` nach dem Early-Return (`if (pendingItems.length === 0) …`) die Overrides laden und den Zutaten-Scan umstellen — aus:

```typescript
    const hasFresh = entry.recipe.ingredients.some(
      (i) => (i.category ?? classifyFreshness(i.name)) === "frisch",
    );
```

wird (mit `const overrides = await getFreshnessOverrides(client);` vor der `entries`-Query):

```typescript
    const hasFresh = entry.recipe.ingredients.some(
      (i) => (i.category ?? resolveFreshness(i.name, overrides)) === "frisch",
    );
```

- [ ] **Step 6: Tests laufen lassen — grün**

Run (in `web\`): `npx vitest run src/lib/services/shoppingSync.test.ts src/lib/repositories/shopping.test.ts`

Expected: PASS (8 + 3 Tests).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/services/shoppingSync.ts web/src/lib/services/shoppingSync.test.ts web/src/lib/repositories/shopping.ts web/src/lib/repositories/shopping.test.ts
git commit -m "feat: Einkaufs-Sync & Frisch-Vorschlag respektieren FreshnessOverrides"
```

---

### Task 5: UI-Toggle am Einkaufs-Item (DTO, Action, Badge)

**Files:**
- Modify: `web/src/lib/data.ts` (ShoppingItem-Interface)
- Modify: `web/src/lib/repositories/shopping.ts` (`getShoppingItems`-Mapping)
- Modify: `web/src/app/actions/shopping.ts`
- Modify: `web/src/components/widgets.tsx` (`ShoppingWidget`)
- Modify: `web/src/components/dashboard.tsx`
- Test: `web/src/lib/repositories/shopping.test.ts`

- [ ] **Step 1: Failing Test — DTO-Mapping**

In `web/src/lib/repositories/shopping.test.ts` einen **neuen, eigenen** describe-Block ans Dateiende anhängen (eigener Client wie im bestehenden Block; Imports `getShoppingItems` aus `./shopping` ergänzen):

```typescript
describe("getShoppingItems", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
    await syncIngredientsToShopping(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("liefert die Haltbarkeits-Kategorie nur für Rezept-Items", async () => {
    const items = await getShoppingItems(client);

    const tomaten = items.find((i) => i.text === "Tomaten");
    const brot = items.find((i) => i.text === "Brot"); // manuell

    expect(tomaten?.category).toBe("frisch");
    expect(brot?.category).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run (in `web\`): `npx vitest run src/lib/repositories/shopping.test.ts`

Expected: FAIL — DTO hat kein `category`-Feld (TypeScript-Fehler) bzw. Mapping liefert es nicht.

- [ ] **Step 3: DTO + Mapping**

In `web/src/lib/data.ts` das `ShoppingItem`-Interface erweitern:

```typescript
export interface ShoppingItem {
  id: string;
  text: string;
  meal: boolean;
  done: boolean;
  /** "frisch" | "haltbar" für Rezept-Items (Korrektur-Toggle sichtbar); null für manuelle. */
  category?: "frisch" | "haltbar" | null;
}
```

In `web/src/lib/repositories/shopping.ts` das Mapping in `getShoppingItems` erweitern:

```typescript
  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    meal: row.meal,
    done: row.done,
    category:
      row.source === "recipe" && (row.category === "frisch" || row.category === "haltbar")
        ? row.category
        : null,
  }));
```

- [ ] **Step 4: Test laufen lassen — grün**

Run (in `web\`): `npx vitest run src/lib/repositories/shopping.test.ts`

Expected: PASS (4 Tests).

- [ ] **Step 5: Server Action**

In `web/src/app/actions/shopping.ts` Import ergänzen und Action anhängen:

```typescript
import { toggleItemFreshness } from "@/lib/repositories/freshnessOverride";
```

```typescript
/**
 * Korrigiert die Haltbarkeit eines Rezept-Einkaufs-Items (frisch ↔ haltbar).
 * Schreibt das Korrektur-Gedächtnis (`FreshnessOverride`), sodass die Zutat
 * künftig direkt richtig eingestuft wird (Sanftes Lernen C1).
 */
export async function toggleFreshnessAction(id: string): Promise<void> {
  await toggleItemFreshness(id);
  revalidatePath("/");
}
```

- [ ] **Step 6: Badge im ShoppingWidget**

In `web/src/components/widgets.tsx` die `ShoppingWidget`-Signatur um den Handler erweitern und das Badge zwischen Text und 🍽️-Icon einfügen:

```tsx
export function ShoppingWidget({
  items,
  onToggle,
  onToggleFreshness,
}: {
  items: ShoppingItem[];
  onToggle: (id: string) => void;
  onToggleFreshness: (id: string) => void;
}) {
```

Im `<li>`-Body nach dem Text-`<span>` (vor dem `item.meal`-Block):

```tsx
            {item.category && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFreshness(item.id);
                }}
                title="Haltbarkeit umschalten — die Korrektur wird für diese Zutat gemerkt"
                className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                  item.category === "frisch"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25"
                    : "bg-cream text-ink-soft dark:bg-white/10 dark:text-cream/70 hover:bg-cream/80 dark:hover:bg-white/15"
                }`}
              >
                {item.category}
              </button>
            )}
```

- [ ] **Step 7: Dashboard-Handler durchreichen**

In `web/src/components/dashboard.tsx`:

Import erweitern — aus:

```typescript
import { toggleShoppingAction } from "@/app/actions/shopping";
```

wird:

```typescript
import { toggleFreshnessAction, toggleShoppingAction } from "@/app/actions/shopping";
```

Nach der `toggleShop`-Definition:

```typescript
  const toggleFreshness = (id: string) => {
    startTransition(async () => {
      await toggleFreshnessAction(id);
    });
  };
```

Und beim Rendern:

```tsx
            <ShoppingWidget items={shopping} onToggle={toggleShop} onToggleFreshness={toggleFreshness} />
```

- [ ] **Step 8: Typecheck + Lint + Suite**

Run (in `web\`):

```bash
npx tsc --noEmit
npm run lint
npm test
```

Expected: alles grün (205 Bestand + 12 neue = 217).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/data.ts web/src/lib/repositories/shopping.ts web/src/lib/repositories/shopping.test.ts web/src/app/actions/shopping.ts web/src/components/widgets.tsx web/src/components/dashboard.tsx
git commit -m "feat: Haltbarkeits-Toggle am Einkaufs-Item schreibt Korrektur-Gedächtnis"
```

---

### Task 6: Doku + Abschluss-Verifikation

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1: README ergänzen**

In `web/README.md` ans Dateiende (nach dem Abschnitt „### Gewichtete Essensplan-Auswahl"):

```markdown
### Haltbarkeits-Korrektur

Stuft die Heuristik eine Zutat falsch ein (z.B. Kokosmilch als „frisch"), lässt
sich das direkt am Einkaufs-Item umschalten — die Korrektur wird gemerkt und
gilt für jedes künftige Auftauchen der Zutat. Reihenfolge: explizite
`freshness`-Angabe im Rezept-Frontmatter → gemerkte Korrektur → Keyword-Heuristik.
```

- [ ] **Step 2: Gesamte Suite + Typecheck + Lint**

Run (in `web\`):

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: Suite PASS (217), Typecheck ohne Fehler, Lint clean.

- [ ] **Step 3: Commit**

```bash
git add web/README.md
git commit -m "docs: Haltbarkeits-Korrektur im README erklärt"
```

---

## Bekannte, bewusste Grenzen (nicht „fixen")

- Eine Korrektur frisch→haltbar **nach** dem Abnicken pusht das Item nicht nachträglich auf Bring — es bleibt in der Einkaufsliste sichtbar und geht mit dem nächsten manuellen Bring-Push mit. Bewusst einfach gehalten.
- Steht im Vault-Frontmatter ein explizites `freshness`, gewinnt es laut Spec über den Override — eine Korrektur am Item wirkt dann nur bis zum nächsten Sync. Korrektur gehört in dem Fall in den Vault.
