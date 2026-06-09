# Design — Einkauf nach Haltbarkeit, gestaffelt auf Bring (Roadmap-Schritt D1)

> **Status:** Genehmigt am 2026-06-09. Nächster Schritt: `superpowers:writing-plans`.
> Quelle: Roadmap `docs/superpowers/plans/2026-06-08-dashboard-roadmap-handy-steuerung-essensplan.md`, Abschnitt **D** (erster Teil D1). D2 (Einkaufstermine „auf dem Weg" aus dem Kalender) und D3 (Einkauf als verteilte Aufgabe/Konto) sind eigene Folgeschritte.

## Ziel

Die Zutaten eines abgenickten Wochenplans werden nicht mehr in einer Rutsche auf
Bring gepusht, sondern nach **Haltbarkeit** in zwei Rutschen: **haltbar** geht
sofort beim Abnicken auf Bring, **frisch** wartet und wird **nah am Verbrauch**
manuell per Knopf gepusht. Das löst die in C1 festgehaltene Anforderung ein und
ersetzt den dort angelegten Platzhalter `planShoppingBatches`.

## Festgelegte Entscheidungen (aus Brainstorming)

- **Haltbarkeits-Quelle:** eine **Kategorie pro Zutat** — „frisch" oder „haltbar"
  — beim Anlegen per Namens-Heuristik vorbelegt, überschreibbar (vorerst nur über
  Daten/Seed, **keine Editier-UI** in D1).
- **Zwei Rutschen** (genau zwei Kategorien → zwei Batches).
- **Staffelung:** beim Abnicken geht **nur haltbar** auf Bring; **frisch** wartet
  und wird per Knopf gepusht (manueller Auslöser — die App hat keinen Scheduler).
- **Vorschlagstag frisch:** der Tag **vor** dem frühesten Verbrauchstag einer
  Frisch-Zutat im aktiven Plan (etwas Vorlauf).
- **Anzeige:** ein eigener `FreshShoppingControl` bei der Einkaufs-Kachel (das
  Entwurf-Panel ist nach der Freigabe verschwunden).

## Datenmodell

```prisma
model Ingredient {
  // ...
  category String? // "frisch" | "haltbar" (per classifyFreshness vorbelegt)
}

model ShoppingItem {
  // ...
  category String? // "frisch" | "haltbar" für Rezept-Items; null für manuelle
  pushed   Boolean @default(false) // schon auf Bring? (nur relevant für Rezept-Items)
}
```

- Additive Felder mit Default/Nullable; Migration via INSERT-SELECT erhält
  Bestandszeilen. Seed-Zutaten bekommen Kategorien (per `classifyFreshness`).
- Manuelle `ShoppingItem` (`source:"manual"`) behalten `category=null` und werden
  von der Frisch/Haltbar-Staffelung nicht berührt (ihr Bring-Push bleibt der
  bestehende `BringSyncControl`-Pfad, unverändert).

Verworfene Alternativen: kein Schema an ShoppingItem + ephemere Berechnung mit
Wochen-Flag (Doppel-Push-Gefahr, unsaubere Idempotenz); Haltbarkeit in Tagen mit
Tages-Mikrobatches (überpräzise, YAGNI — bewusst zwei Kategorien gewählt).

## Architektur

### Reine Logik

- **`classifyFreshness(name): "frisch" | "haltbar"`** (neu, rein, eigenes Modul
  `src/lib/services/freshness.ts`): Schlüsselwort-Heuristik (case-insensitiv,
  Teilstring-Match auf den Namen). Frisch-Schlüsselwörter z. B. salat, milch,
  joghurt, sahne, quark, fleisch, hack, hähnchen, fisch, lachs, kräuter,
  basilikum, petersilie, schnittlauch, tomate, gurke, zucchini, paprika, salat,
  karotte, möhre, banane, apfel, beeren, ei. Sonst → „haltbar" (Default).
  Reine Funktion, kein DB/Next.
- **`suggestFreshShoppingDay(earliestFreshUse: Date | null): Date | null`** (rein,
  in `freshness.ts`): `earliestFreshUse ? addDays(earliestFreshUse, -1) : null`.

### Services / Repository

- **`syncIngredientsToShopping`** (`shoppingSync.ts`, Anpassung): schreibt jedes
  Rezept-`ShoppingItem` zusätzlich mit `category` (aus `Ingredient.category`,
  Fallback `classifyFreshness(name)` falls null) und `pushed=false`. Der bestehende
  active-Filter (nur `status:"active"`-MealPlanEntries) bleibt.
- **`pushRecipeBatch(category, client)`** (neu, in `shoppingSync.ts` oder neuem
  `shoppingBatch.ts`): lädt offene, noch nicht gepushte Rezept-Items dieser
  Kategorie (`source:"recipe"`, `category`, `pushed:false`, `done:false`), pusht
  sie via `pushShoppingList`, setzt bei Erfolg `pushed=true`, liefert
  `{ bring: BringPushResult; items: string[] }` (items für den Kopier-Fallback).
- **`getFreshShoppingState(client)`** (neu, Repository): offene Frisch-Rezept-Items
  (`source:"recipe"`, `category:"frisch"`, `pushed:false`, `done:false`) + Vorschlag-
  tag. Der Vorschlagstag kommt aus dem aktiven Plan: frühester `MealPlanEntry.date`
  (`status:"active"`) der Woche, dessen Rezept eine Zutat mit `category:"frisch"`
  enthält → `suggestFreshShoppingDay`. Rückgabe DTO `FreshShoppingState`
  `{ pendingItems: string[]; suggestedDayISO: string | null }`.

### Server Actions (`src/app/actions/meals.ts`)

- **`approveDraftAction`** (Anpassung): nach erfolgreichem `approveDraft` →
  `syncIngredientsToShopping` → **`pushRecipeBatch("haltbar")`** (nur haltbar) →
  `getFreshShoppingState` → revalidate. `ApprovePlanResult` wird erweitert:
  `{ approved; ingredients; bring; fresh: FreshShoppingState }` (`ingredients` =
  die gepushten Haltbar-Namen für den Kopier-Fallback). Frisch bleibt offen.
- **`pushFreshBatchAction()`** (neu): `pushRecipeBatch("frisch")` → revalidate →
  liefert `{ bring: BringPushResult; items: string[] }` für Pille/Fallback.
- Der C1-`planShoppingBatches` (`shoppingBatches.ts` + Test) und der bisherige
  Batch-Push-Loop in `approveDraftAction` werden **entfernt**.

### UI

- **`FreshShoppingControl`** (neu, Client-Component): nur sichtbar, wenn
  `fresh.pendingItems.length > 0`. Zeigt „Frische-Einkauf · Vorschlag <Wochentag>"
  (Wochentag aus `suggestedDayISO`), die Item-Namen, und einen Knopf „Jetzt auf
  Bring" → `pushFreshBatchAction()`; danach Bring-Pille bzw. „Bring fehlte —
  Zutaten kopieren"-Fallback (Muster wie im `MealDraftPanel`).
- Platzierung bei der Einkaufs-Kachel (`ShoppingWidget`-Bereich). Optional ein
  kleiner „frisch"-Hinweis an Rezept-Items der Liste (gering, kann entfallen).
- `page.tsx` lädt `getFreshShoppingState()`; `dashboard.tsx` reicht den Zustand
  an den `FreshShoppingControl` durch und rendert ihn bedingt.

## Fehlerfälle

- Keine Frisch-Zutaten im Plan → leerer `pendingItems`, `suggestedDayISO=null`,
  kein Control.
- Bring-Fehler (haltbar beim Abnicken oder frisch per Knopf) → ändert den
  Plan-/Item-Zustand **nicht** (`pushed` wird nur bei Erfolg gesetzt); Kopier-
  Fallback wie bisher.
- Erneutes Abnicken eines neuen Plans → `syncIngredientsToShopping` wischt die
  alten `source:"recipe"`-Items und legt sie neu an (`pushed=false`) — die alte
  Frische-Pending wird sauber ersetzt.

## Tests

- **Pure:** `classifyFreshness` (Frisch-Treffer, Haltbar-Default, case-insensitiv,
  Teilstring); `suggestFreshShoppingDay` (Datum→Tag-davor, null→null,
  Monatsgrenze).
- **Services (geseedete DB):**
  - `syncIngredientsToShopping` taggt Rezept-Items mit `category` + `pushed=false`.
  - `pushRecipeBatch("haltbar")` pusht/markiert nur Haltbar-Items, lässt Frisch
    unberührt; `pushRecipeBatch("frisch")` analog; erneuter Aufruf pusht nichts
    mehr (alle `pushed`). (Bring-Push in Tests injizierbar/gemockt oder über die
    `pushShoppingList`-Schnittstelle — Push selbst ist nicht unit-getestet; die
    Markier-/Auswahl-Logik schon.)
  - `getFreshShoppingState`: offene Frisch-Items + korrekter Vorschlagstag
    (frühester Frisch-Verbrauch − 1) gegen einen geseedeten Plan.
- Bestehende active-Filter-Tests bleiben grün.

## Schritt D2/D3 — Anforderung & Naht (bewusst außerhalb D1)

- **D2 (Einkaufstermine „auf dem Weg"):** Kalender-Events mit `place` durchsuchen
  und den Frisch-Push-Tag/-Ort vorschlagen, wenn jemand ohnehin unterwegs ist. Die
  Naht ist `getFreshShoppingState` (Vorschlagstag) + der manuelle Push — D2
  verfeinert die Vorschlagslogik und ergänzt ggf. „wer/wo".
- **D3 (Einkauf als verteilte Aufgabe):** Einkauf als `Task` (`type:"shopping"`,
  existiert bereits) in die Verteil-/Konto-Engine einhängen.

## Bewusst außerhalb des Scopes (YAGNI für D1)

- Editier-UI für Zutaten-Kategorien (Default genügt vorerst).
- Kalender-„auf dem Weg" (D2), Aufgaben-/Konto-Integration (D3).
- Mehr als zwei Haltbarkeits-Stufen / numerische Tage.
