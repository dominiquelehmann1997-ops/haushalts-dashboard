# Design — Essensplan-Entwurf + Abnicken/Ändern (Roadmap-Schritt C1)

> **Status:** Genehmigt am 2026-06-09. Nächster Schritt: `superpowers:writing-plans`.
> Quelle: Roadmap `docs/superpowers/plans/2026-06-08-dashboard-roadmap-handy-steuerung-essensplan.md`, Abschnitt **C** (erster Teil C1). C2 (Benachrichtigung aufs Handy) und C3 (automatischer Auslöser „wenn beide zuhause") sind eigene Folgeschritte.

## Ziel

Ein generierter Wochenplan wird zunächst ein **Entwurf** (pending) statt sofort
der aktive Plan. Dome oder Emely schauen den Entwurf an und **nicken ihn ab**
oder **ändern** ihn (Tag-Gericht tauschen / einzelnen Tag neu würfeln). Erst beim
Abnicken wird der Entwurf zum aktiven Plan **und** die Zutaten gehen auf
Einkaufsliste + Bring. Der gut bedienbare Entwurfs-/Freigabe-Flow zahlt auf die
Leitidee „Handy steuert, Tablet zeigt" ein.

## Festgelegte Entscheidungen (aus Brainstorming)

- **Freigabe:** **Einer reicht** (Dome ODER Emely). Kein Per-Person-Status.
- **Ändern:** **Tag-Gericht tauschen** (Rezept aus dem Buch wählen) und
  **einzelnen Tag neu würfeln** (dienstbewusst). Ganze Woche neu würfeln gibt es
  bereits (= Entwurf neu erzeugen).
- **Anzeige:** Die Essensplan-Kachel zeigt weiter den **zuletzt abgenickten
  (aktiven) Plan**; der **Entwurf** lebt in einer **separaten Ansicht/Karte**.
- **Zutaten/Bring:** **erst beim Abnicken** — Entwurf erzeugen/ändern fasst den
  Einkauf nicht an.
- **Verwerfen:** Ein Entwurf kann verworfen werden (sonst bleibt er hängen).

## Datenmodell (Ansatz A — `status`-Feld)

`MealPlanEntry` bekommt ein Feld:

```prisma
model MealPlanEntry {
  // ...
  status String @default("active") // "active" | "draft"
}
```

- Werte: `"active"` (der gezeigte Plan) und `"draft"` (der Entwurf).
- Pro Woche koexistieren **bis zu 5 aktive + 5 Entwurfs-Zeilen**.
- Seed-Einträge sind durch den Default **aktiv** — bestehende Anzeige unverändert.
- Migration: additives Feld mit Default, INSERT-SELECT erhält Bestandszeilen.

Verworfene Alternativen: separate `DraftMealPlanEntry`-Tabelle (dupliziert
Schema + Mapping, Drift-Risiko); `MealPlan`-Elternobjekt mit Status (großer
Query-Umbau, YAGNI für „einer reicht / eine Woche").

## Architektur

### Pure Logik

- **`constraintFromEntry(reason, extraPortion)`** (neu, rein, in
  `mealConstraints.ts`): rekonstruiert verlustfrei `{ needsSimple,
  needsReheatable }` aus einem gespeicherten Eintrag.
  - `needsSimple = reason === "emely-allein"`
  - `needsReheatable = extraPortion` (gilt, weil `deriveDayConstraints` immer
    `extraPortion === needsReheatable` setzt)
  - Konflikt-Tag (reason `emely-allein` **und** extraPortion `true`) → beide
    `true`. Unit-getestet über alle Kombinationen.
- **`candidatesFor(constraint, recipes, preferSimple)`** wird aus
  `mealPlanner.ts` **exportiert**, damit Re-Roll dieselbe Pool-/Konflikt-Logik
  nutzt (keine zweite Auswahl-Implementierung).

### Services

- **`generateWeekPlan(weekStart, opts, client, rng)`** schreibt künftig
  `status: "draft"`; der Replace-Delete wird auf **`status:"draft"`** der Woche
  eingegrenzt. Erzeugt also einen Entwurf; aktiv und Einkauf bleiben unberührt.
  (Doc-Kommentar entsprechend anpassen.)
- **`approveDraft(weekStart, client)`** (neu): in **einer Transaktion** die
  aktiven Einträge der Woche löschen und die Entwurfs-Einträge auf
  `status:"active"` setzen. Guard: kein Entwurf → no-op (false zurückgeben).
- **`rerollDraftDay(date, preferSimple, client, rng)`** (neu): Entwurfs-Eintrag
  des Tages laden → `constraintFromEntry` → `candidatesFor` → das **aktuelle
  Rezept möglichst ausschließen** → neues Rezept wählen (rng) → `recipeId`
  updaten. `reason`/`extraPortion` bleiben.
- **`setDraftDayRecipe(date, recipeId, client)`** (neu): manueller Tausch —
  nur `recipeId` des Entwurfs-Eintrags updaten.
- **`discardDraft(weekStart, client)`** (neu): Entwurfs-Einträge der Woche
  löschen.

### Repository

- **`getWeekMealPlan`**: `where` um `status: "active"` ergänzen.
- **`getDraftMealPlan(client)`** (neu): wie `getWeekMealPlan`, aber
  `status: "draft"`; liefert zusätzlich `recipeId` je Tag (fürs Tausch-Picker).
- **`listRecipes(client)`** (neu, falls nicht vorhanden): `{ id, name }[]` nach
  Name sortiert, fürs Tausch-Picker.
- **`syncIngredientsToShopping`**: `where` um `status: "active"` ergänzen
  (Entwurf darf nie in den Einkauf einfließen).

### Einkaufs-/Push-Naht (batch-vorbereitet)

- **`planShoppingBatches(ingredientNames): IngredientBatch[]`** (neu): gruppiert
  die Zutaten in Einkaufs-Rutschen. **In C1: genau eine Rutsche**
  (`[{ items: alle }]`). `IngredientBatch = { items: { name: string }[] }`
  (Label/Datum optional, für D vorgesehen).
- Der Approve-Flow **iteriert** die Batches und pusht jede via `pushShoppingList`
  einzeln auf Bring. In C1 ist das genau ein Push (Verhalten wie heute).

### Server Actions (`src/app/actions/meals.ts`)

- **`generatePlanAction(weekStart)`** → baut Constraints (wie heute aus
  `getDomeShiftsForWeek` + `deriveDayConstraints`) → `generateWeekPlan`
  (**Entwurf**) → `revalidatePath("/")`. **Keine** Zutaten/Bring mehr hier.
  Rückgabeform vereinfacht sich (kein `bring`/`ingredients`).
- **`rerollDraftDayAction(dateISO)`**, **`setDraftDayRecipeAction(dateISO,
  recipeId)`** → bearbeiten + revalidate.
- **`approveDraftAction(weekStart)`** → `approveDraft` → bei Erfolg
  `syncIngredientsToShopping` → `planShoppingBatches` → pro Batch
  `pushShoppingList` → revalidate. Liefert das (aggregierte) Bring-Ergebnis für
  die UI-Pille + Kopier-Fallback. Bring-Fehler ändert **nicht** den Plan-Status
  (Plan ist aktiv, wie heute).
- **`discardDraftAction(weekStart)`** → `discardDraft` + revalidate.

### UI

- **`MealPlanWidget`** unverändert — zeigt den **aktiven** Plan.
- **`MealDraftPanel`** (neu, Client-Component): eigene Karte direkt unter der
  Essensplan-Kachel, **nur sichtbar wenn ein Entwurf existiert**.
  - Kopf „Entwurf · Woche" mit **Abnicken** (primär) + **Verwerfen**.
  - 5 Tagesreihen: Tag-Label, Gericht, dienstbewusstes Badge (Wiederverwendung
    der Badge-Logik), **„🎲 neu würfeln"** und **„tauschen"** (kleiner
    Rezept-Picker aus `listRecipes`).
  - **Abnicken** ruft `approveDraftAction` → zeigt das Bring-Ergebnis (Pille +
    „Zutaten kopieren"-Fallback wie heute in `MealPlanControl`).
- **`MealPlanControl`** „Woche neu planen" erzeugt jetzt den **Entwurf**; das
  Bring-Feedback wandert von hier ins `MealDraftPanel` (ans Abnicken).
- **`page.tsx`** lädt aktiven Plan (`getWeekMealPlan`) + Entwurf
  (`getDraftMealPlan`) + Rezeptliste (`listRecipes`) und rendert
  `MealPlanWidget` + (falls Entwurf) `MealDraftPanel`.

## Fehlerfälle

- Abnicken/Reroll/Swap ohne passenden Entwurfs-Eintrag → Guard/no-op.
- Bring-Fehler beim Abnicken → Plan wird trotzdem aktiv; manueller
  Kopier-Fallback (wie heute).
- `generateWeekPlan` mit leerem Rezeptbuch → wie heute `[]` (kein Entwurf).

## Tests

- **Pure:** `constraintFromEntry` über alle reason/extraPortion-Kombinationen
  inkl. Konflikt; `planShoppingBatches` (C1: genau eine Rutsche mit allen
  Zutaten).
- **Services (geseedete DB):**
  - `generateWeekPlan` schreibt nur Entwurf; bestehende aktive Einträge bleiben.
  - `approveDraft` ersetzt aktiv durch Entwurf; Entwurf danach leer; no-op ohne
    Entwurf.
  - `rerollDraftDay` ändert das Rezept und respektiert den Constraint (z. B.
    Spät-Tag bleibt `simple`); `setDraftDayRecipe` tauscht exakt.
  - `discardDraft` entfernt nur Entwurf.
  - `getWeekMealPlan` (nur aktiv) / `getDraftMealPlan` (nur Entwurf)
    Status-Filter; `syncIngredientsToShopping` ignoriert Entwurf.
- **Action-Ebene (leicht):** `approveDraftAction` synct + pusht erst nach
  erfolgreicher Beförderung.

## Schritt D — Anforderung & Naht (bewusst außerhalb C1)

> **Anforderung (vom Auftraggeber):** Je nach **Haltbarkeit** der Zutaten sollen
> ggf. **zwei oder mehr Einkäufe pro Woche** erfolgen; die Zutaten werden dann in
> **zwei oder mehr Rutschen** auf Bring gepusht (statt alles auf einmal).

C1 bereitet das vor, ohne es zu bauen:
- Die Erweiterungsstelle ist **`planShoppingBatches`** — Schritt D ersetzt nur
  diese Funktion (Gruppierung nach Haltbarkeit/Einkaufstermin → mehrere Batches,
  je mit optionalem Datum/Label) und ggf. den **Push-Zeitpunkt**. Der
  Approve-Flow und der Push-Loop (iterieren über Batches) bleiben unverändert.
- Voraussichtlich nötig für D: Haltbarkeits-/Shelf-Life-Info pro Zutat,
  Einkaufstermin-Findung (auch „auf dem Weg", Kalender-Termine mit Ort),
  zeitlich gestaffeltes Pushen.

## Bewusst außerhalb des Scopes (YAGNI für C1)

- Haltbarkeits-Batching / mehrere Einkäufe (Schritt D, s. o.).
- Benachrichtigung aufs Handy (C2) und automatischer Auslöser „wenn beide
  zuhause" (C3).
- Per-Person-Freigabe / Freigabe-Historie (Entscheidung: „einer reicht").
