# Design — Dienstplan-bewusster Essensplan (Roadmap-Schritt B)

> **Status:** Genehmigt am 2026-06-09. Nächster Schritt: `superpowers:writing-plans`.
> Quelle: Roadmap `docs/superpowers/plans/2026-06-08-dashboard-roadmap-handy-steuerung-essensplan.md`, Abschnitt **B**.

## Ziel

Der Wochen-Essensplan soll sich am **Dienstplan** orientieren statt nur Rezepte
zu mischen. Konkret: an Tagen, an denen **Dome Spätdienst** hat, kocht **Emely
allein** → einfaches Gericht. Am **Tag vor Domes Spätdienst** und am **Tag von
Domes Nachtdienst** wird ein **gut aufwärmbares** Gericht mit **Extraportion**
geplant, damit Dome sich Essen mit zur Arbeit nehmen/aufwärmen kann.

## Schicht-Vokabular (Google-Kalender, personKey `dome`)

Exakte Event-Titel (case-insensitiv, getrimmt, Voll-Match wie bei `isOvernightShift`):

| Titel        | Bedeutung    | Klasse     |
|--------------|--------------|------------|
| `Früh`       | Frühdienst   | `frueh`    |
| `Spät`       | Spätdienst   | `spaet`    |
| `LT`         | langer Tag   | `lt`       |
| `Nacht`,`LN` | Nachtdienst  | `nacht`    |

`Früh` und `LT` lösen aktuell **keine** Koch-Constraint aus (vom Auftraggeber
bestätigt) — sie werden klassifiziert, aber von der Regel-Logik ignoriert.
Klassifizierung ohne Treffer → `null`.

## Regeln (Planungstage Mo–Fr)

Für jeden Planungstag `D`:

- **`needsSimple`** ⇐ Dome hat an `D` Spätdienst (`spaet`).
- **`needsReheatable` + `extraPortion`** ⇐ Dome hat an `D+1` Spätdienst
  (`D` ist „Tag vor Spät") **oder** an `D` Nachtdienst (`nacht`).

Weil „Tag vor Spät" auch der **Freitag** sein kann (Spät am Samstag), werden
Domes Schichten für **Mo–Sa** eingelesen (Sa nur als Lookahead, nicht geplant).

### Konfliktauflösung

Ein Tag kann gleichzeitig `needsSimple` **und** `needsReheatable` verlangen
(z. B. Spät an `D` und an `D+1`). Auswahl-Priorität:

1. Rezept das **beide** Eigenschaften erfüllt (`simple && reheatable`) — bevorzugt.
2. Gibt es keins: **`simple` hat Vorrang** (Emely muss allein kochen können);
   `reheatable` wird zum Nice-to-have. `extraPortion` bleibt gesetzt.

### Extraportion

In Schritt B ist `extraPortion` **nur ein sichtbarer Marker** auf dem Tages-
Eintrag (Anzeige + persistiert). Echte Einkaufsmengen/Haltbarkeit folgen erst in
Roadmap-Schritt D — hier bewusst kein Eingriff in `syncIngredientsToShopping`.

## Architektur

Folgt dem etablierten Muster „reiner Mapper + Unit-Test, DB/Next außen herum"
(vgl. `shifts.ts` ↔ `repositories/calendar.ts`).

### 1 · `web/src/lib/calendar/shifts.ts` (rein, erweitern)

Neue Funktion neben den bestehenden (unverändert bleiben `isOvernightShift`,
`correctedBusyEnd`):

```ts
type ShiftClass = "frueh" | "spaet" | "lt" | "nacht";
function classifyShift(title: string): ShiftClass | null;
```

### 2 · `web/src/lib/services/mealConstraints.ts` (rein, neu)

```ts
interface DayConstraint {
  date: Date;
  needsSimple: boolean;
  needsReheatable: boolean;
  extraPortion: boolean;
  reason: "emely-allein" | "aufwaermen-extra" | null;
}

// shiftByDay: Domes Schicht-Klasse je lokalem Tag (Mo–Sa) oder null.
function deriveDayConstraints(
  weekMonday: Date,
  shiftByDay: (date: Date) => ShiftClass | null,
): DayConstraint[]; // genau Mo–Fr (5 Einträge)
```

`reason` priorisiert für die Anzeige: bei `needsSimple` → `"emely-allein"`,
sonst bei `needsReheatable` → `"aufwaermen-extra"`, sonst `null`. (Die booleans
tragen die volle Wahrheit für die Auswahl; `reason` ist die Anzeige-Verdichtung.)

### 3 · Schema (`web/prisma/schema.prisma`) + Migration

```prisma
model Recipe {
  // ...
  reheatable Boolean @default(false)   // Spiegel zu `simple`
}

model MealPlanEntry {
  // ...
  reason       String?  // "emely-allein" | "aufwaermen-extra" | null
  extraPortion Boolean @default(false)
}
```

Migration anlegen; bei den 5 Bestandsrezepten sinnvolle `reheatable`-Defaults
setzen (Eintopf-/Ofen-Gerichte wie Gemüse-Curry, Ofengemüse = aufwärmbar;
Pizzaabend = nicht).

### 4 · `web/src/lib/services/mealPlanner.ts` (erweitern)

`generateWeekPlan` nimmt zusätzlich `constraints: DayConstraint[]` (Mo–Fr).
Pro Tag:

1. Kandidatenpool = Rezepte, die die Tages-Constraints erfüllen (Konflikt-
   Priorität s. o.). Leerer Pool → Fallback auf die bisherige geordnete Liste.
2. Auswahl aus dem Pool deterministisch über das injizierbare `rng`
   (Shuffle-Muster bleibt, Tests bleiben deterministisch). `preferSimple`
   (Elternzeit) bleibt Tiebreaker innerhalb des Pools.
3. Persistiert je Entry zusätzlich `reason` + `extraPortion`.

### 5 · Anbindung & Anzeige

- **Neu** `web/src/lib/repositories/meals.ts` → `getDomeShiftsForWeek(weekStart)`:
  Query `CalendarEvent` (personKey `dome`, Mo–Sa der Zielwoche), Titel via
  `classifyShift` → Map Datum→`ShiftClass`. (DB-Schicht, ruft die reine Funktion.)
- **`web/src/app/actions/meals.ts`**: lädt Constraints (Repo → `deriveDayConstraints`)
  und reicht sie an `generateWeekPlan`. Bring!/Shopping-Sync unverändert.
- **`getWeekMealPlan`** liefert `reason`/`extraPortion` mit (Domain-`Meal` erweitern).
- **`MealPlanWidget`** zeigt ein kleines Badge je Tag:
  `emely-allein` → „Emely allein", `aufwaermen-extra` → „Aufwärmen · +Portion Dome".

## Tests

- **Rein/Unit:** `classifyShift` (alle Titel + Negativfälle wie „Nachtisch");
  `deriveDayConstraints` inkl. Tag-vor-Spät am Freitag und Konflikt-Tag
  (Spät an D und D+1).
- **Planer:** `generateWeekPlan` mit injizierten Constraints + festem `rng` —
  prüft Pool-Auswahl, Konflikt-Priorität, Fallback bei leerem Pool, persistierte
  `reason`/`extraPortion`.
- **Repo:** `getDomeShiftsForWeek` gegen geseedete DB (Muster aus
  `meals.test.ts` / `calendar.test.ts`).

## Bewusst außerhalb des Scopes (YAGNI)

- Echte Einkaufsmengen/Haltbarkeit für die Extraportion → Roadmap-Schritt D.
- Push/Freigabe-Flow des Entwurfs → Roadmap-Schritt C.
- Schicht-Constraints für `Früh`/`LT` → derzeit keine Regel gewünscht.
