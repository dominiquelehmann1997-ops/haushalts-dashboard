# Sanftes Lernen — Design

**Datum:** 2026-06-10
**Status:** Abgenickt (Brainstorming), bereit für Implementierungsplan
**Kontext:** Haushalts-Dashboard (`web/`, Next.js + Prisma/SQLite + Vitest). Ziel: das Dashboard soll aus den tatsächlichen Gewohnheiten lernen, statt rein auf festen Heuristiken zu laufen — ohne LLM, lokal, gedämpft.

## Motivation

Das Dashboard ist heute regelbasiert/heuristisch, nicht lernend: Essensplan würfelt zufällig (`mealPlanner.ts`), Frische kommt aus einer starren Keyword-Liste (`freshness.ts`), Aufgaben-Rhythmen sind fix konfiguriert. Die Datenbasis fürs Lernen ist aber vorhanden (`Task`-Historie, `AccountEntry`, `ShoppingItem`, `MealPlanEntry`, `CalendarEvent`). Dieses Design ergänzt **vier kleine Lern-Features** auf einem gemeinsamen Prinzip.

Bewusst **kein** LLM-im-Loop: bei Haushaltsgröße ist der Nutzen schmal, der Aufwand (Validierungs-Layer, Host/Scheduler — heute nicht vorhanden, Wartungssteuer) hoch, und ein nicht-deterministisches System erhöht eher die Kontroll-Last. ~80 % der mental-load-Entlastung kommt aus deterministischem, sanftem Lernen.

## Tragendes Prinzip „Sanftes Lernen"

Gilt für alle vier Features:

- **Heuristik bleibt Fallback** — kein Kaltstart-Problem; ohne Daten verhält sich alles wie heute.
- **Lernen verschiebt nur Gewichte/Defaults, nie harte Regeln** — Dienstplan-Constraints, Schicht-Logik (`mealConstraints.ts`, `shifts.ts`) etc. bleiben absolut. Gelernt wird nur *innerhalb* des Erlaubten.
- **Gedämpft** — Mindestanzahl Beobachtungen, bevor etwas zählt; kleine Schrittweiten / robuste Statistik. „Nicht penibel" ist eingebaut.
- **Transparent & überschreibbar** — jede gelernte Größe ist sichtbar und manuell korrigierbar; manuell gesetzte Baselines werden nie überschrieben.
- **Berechnet beim Lesen** — nur echte Eingaben (Rating, Korrektur) und nötige Zeitstempel werden gespeichert; Zeitreihen-Werte kommen per reiner Funktion aus der vorhandenen Historie.

## Architektur

Entscheidung: **berechnet beim Lesen** (statt materialisiert gespeichert). Passt zum bestehenden Codebase-Muster (reine Mapper + Unit-Tests, z.B. `freshness.ts`, `fairness.ts`, `mealConstraints.ts`): deterministisch, auditierbar, kaum neues Schema. Persistiert werden nur echte Eingaben und ein Zeitstempel:

- `Recipe.rating` (Cache-Feld) — gespiegelt aus dem Vault-Frontmatter (kein Dashboard-Input)
- `FreshnessOverride` (neue Tabelle) — echte Korrektur
- `ShoppingItem.pushedAt` (neues Feld) — Zeitstempel zur späteren Vorlauf-Messung
- „Aufschieben"-Markierung an Aufgaben — über vorhandenes `Task.status="moved"` + Reason

Alle gelernten Werte (Gewichtung, EWMA-Intervall, Vorlauf) werden bei Bedarf aus Historie + diesen gespeicherten Größen berechnet.

---

## Feature A — Essensplan-Gewichtung

**Problem:** `generateWeekPlan` (`mealPlanner.ts`) shuffelt zufällig und nimmt das erste noch-nicht-diese-Woche-benutzte Rezept. Es lernt nicht, was tatsächlich oft/gern gekocht wird.

**Quelle des Ratings:** `Recipe.rating` (`"favorit" | "ok" | "selten"`, Default `"ok"`). Das Rating wird **nicht** über ein Dashboard-UI gesetzt, sondern kommt aus dem **Obsidian-Vault-Frontmatter** und wird beim Ingest in die DB gespiegelt — siehe [2026-06-10-rezepte-vault-design.md](2026-06-10-rezepte-vault-design.md). **Voraussetzung: Rezepte-Vault V1 (Schema + Ingest).**

**Auswahl-Logik:**

1. **Gewichtete Auswahl** statt reinem Zufall — `favorit` ~3×, `ok` 1×, `selten` ~0,3× Wahrscheinlichkeit, **innerhalb** des durch die Schicht-Constraints erlaubten Pools (`candidatesFor`).
2. **Recency-Meidung aus Historie** — statt nur „nicht diese Woche": eine reine Funktion liest die letzten ~14–21 Tage `MealPlanEntry` und dämpft kürzlich gekochte Gerichte. Lernen aus Daten ohne neuen Klick — federt den statischen-Rating-Kompromiss ab.
3. **Constraints bleiben harte Filter** — Gewichtung ordnet nur innerhalb des erlaubten Pools um; leert sich der Pool, Fallback auf heutiges Verhalten.

**Reine Funktion:** `weightedPick(pool, ratings, recentHistory, rng)` → deterministisch mit injiziertem `rng` (wie der bestehende `shuffle`), Unit-getestet.

**Kein Dashboard-UI nötig:** Rating wird im Vault gepflegt (Frontmatter), nicht im Dashboard.

---

## Feature B — Adaptives Aufgaben-Intervall

**Problem:** Routinen haben einen fix konfigurierten `rhythm`; das System lernt nicht, wie oft etwas *wirklich* getan wird.

**Mechanik:** Die gelernte Frequenz einer Routine ist der **EWMA der real erzielten Abstände zwischen Erledigungen** — die `completedAt`-Kette einer Routine (gruppiert über `recurringParentId`), gefaltet zu einem gleitenden Mittelwert. Berechnet beim Lesen; für die Zeitreihe wird nichts gespeichert.

**Beide Signale wirken implizit über die realen Abstände:**

- **„Aufschieben" (noch nicht nötig)** schiebt das Fälligkeitsdatum raus → nächster realer Abstand wird länger → EWMA steigt. Der Button ist v.a. UX (kein Genörgel, Datum raus); der Lern-Effekt ergibt sich aus dem späteren `completedAt`.
- **Früher manuell nachgetragen + erledigt** → kürzerer realer Abstand → EWMA sinkt.

Kein Sonderfall-Rechnen.

**Dämpfung („nicht penibel"):**

- kleiner EWMA-Faktor (α ≈ 0,25) → ein Ausreißer bewegt wenig;
- **Mindestens N≈3 erledigte Abstände**, bevor der gelernte Wert den konfigurierten `rhythm` ablöst — darunter gilt der eingestellte Rhythmus;
- optionaler Klemmwert, der den Schritt eines einzelnen extremen Abstands begrenzt.

**`rhythm` bleibt unangetastet** als sichtbarer Baseline/Fallback. Der Recurrence-Generator fragt `learnedInterval(routineId)` und nutzt ihn nur ab N Beobachtungen, sonst `rhythm`.

**Neu nötig:** „Aufschieben"-Element an der Aufgabe (setzt nächstes Fälligkeitsdatum raus + markiert via `status="moved"` + Reason).

**Reine Funktion:** `learnedInterval(history)` → Unit-getestet mit fixen Historien.

**Edge-Case:** Wird ständig aufgeschoben, aber nie erledigt, existiert kein Erledigungs-Abstand → konfigurierter Rhythmus bleibt bis zur nächsten echten Erledigung. Bewusst träge statt penibel.

---

## Feature C — Frische/Einkauf

### C1 — Haltbarkeits-Korrektur-Gedächtnis

**Problem:** `classifyFreshness(name)` (`freshness.ts`) klassifiziert per Keyword; `Ingredient.category` überschreibt nur lokal. „Kokosmilch" wird bei jedem neuen Auftauchen wieder falsch als „frisch" eingestuft.

**Neu gespeichert:** Tabelle `FreshnessOverride` (normalisierter Name → `"frisch" | "haltbar"`). Eine Korrektur upserted den Override.

**Logik:** Auflösungsreihenfolge **Frontmatter-`freshness` (aus dem Rezepte-Vault, falls am Zutaten-Item vorhanden) → C1-Override → Keyword-Heuristik**. `resolveFreshness(name, overrides)` deckt die letzten beiden Stufen ab; die Frontmatter-Angabe kommt bereits als `Ingredient.category` aus dem Vault-Ingest. Echte Eingabe → gespeichert; Heuristik bleibt Fallback.

**UI:** Korrektur-Möglichkeit am Einkaufs-/Zutaten-Item (frisch ↔ haltbar umschalten), die den Override schreibt.

### C2 — Gelernter Einkaufs-Vorlauf

**Problem:** `suggestFreshShoppingDay` ist fix `addDays(earliestFreshUse, -1)`.

**Mechanik:** Realer Vorlauf = `Verbrauchsdatum − tatsächlicher Einkaufstag`, gelernt aus Historie, berechnet beim Lesen. Verbrauchsdatum kommt aus `MealPlanEntry` über `ShoppingItem.recipeRef → Recipe`; Einkaufstag aus dem neuen `pushedAt`.

**Granularität mit geschichtetem Fallback:** pro Zutat (wenn genug Beobachtungen) → sonst Aggregat pro Kategorie (`frisch`) → sonst fixer Default −1 Tag.

**Robust/nicht penibel:** Median statt Mittel (gegen Ausreißer) + Mindest-Beobachtungen.

**Daten-Lücke / nötige Ergänzung:** Heute gibt es nur `ShoppingItem.pushed` (bool), keinen Zeitstempel. Um den realen Vorlauf zu *messen*, ist **`ShoppingItem.pushedAt DateTime?`** nötig, gesetzt beim Pushen. Ohne das kann C2 nichts messen.

**Reine Funktion:** `learnedLeadTime(history, ingredient, category)` → Unit-getestet.

---

## Schema-Änderungen (Zusammenfassung)

- `Recipe.rating String @default("ok")` — `"favorit" | "ok" | "selten"`, befüllt vom Vault-Ingest (s. Rezepte-Vault-Spec; dort auch `Recipe.slug`/`archived`)
- `ShoppingItem.pushedAt DateTime?` — gesetzt beim Push auf Bring
- Neue Tabelle `FreshnessOverride { id, name (unique, normalisiert), freshness ("frisch"|"haltbar") }`
- Keine Schema-Änderung für Aufgaben-Lernen — „Aufschieben" nutzt vorhandenes `Task.status="moved"` + `reason`.

> Hinweis (aus Projekt-Memory): nach `prisma migrate dev` immer `node node_modules/prisma/build/index.js generate` ausführen — der Client wird hier sonst nicht zuverlässig regeneriert. `web/src/generated` ist gitignored.

## Reine Funktionen & Tests

Jede Lern-Logik als reine Funktion (kein DB/Next), Vitest-Unit-Test mit injiziertem `rng`/fixen Historien — Muster wie bestehende Engine/Services (174 Tests grün):

| Funktion | Zweck |
|---|---|
| `weightedPick(pool, ratings, recentHistory, rng)` | Essensplan-Auswahl (Feature A) |
| `learnedInterval(history)` | EWMA-Intervall einer Routine (Feature B) |
| `resolveFreshness(name, overrides)` | Override vor Heuristik (Feature C1) |
| `learnedLeadTime(history, ingredient, category)` | Median-Vorlauf mit Fallback (Feature C2) |

Integration nur dort, wo es Generator/Actions berührt (`mealPlanner.ts`, Recurrence-Generator, Frisch-Vorschlag, Shopping-Actions).

## Build-Reihenfolge (3 Phasen)

Leitgedanke: sofort spürbare Wins und Daten-Erfassung zuerst — Zeitreihen-Features zahlen sich erst nach Wochen Historie aus, also muss das Mitschreiben früh stehen. Jedes Feature ist eine eigene Implementierungs-Aufgabe.

- **Phase 1 — Fundament + sofortige Wins:** zuerst **Rezepte-Vault V1** (Voraussetzung, eigene Spec), darauf **Feature A** (Gewichtung + Recency); parallel **C1** (Haltbarkeits-Korrektur), isoliert.
- **Phase 2 — Erfassung (auch ohne Lernen nützlich):** „Aufschieben"-Element an Aufgaben (UX-Nutzen sofort) und `ShoppingItem.pushedAt`. Schreibt ab jetzt die Historie für Phase 3 mit.
- **Phase 3 — gelernte Lese-Werte:** Feature B (`learnedInterval` im Generator) und C2 (`learnedLeadTime` im Frisch-Vorschlag). Greifen, sobald genug Daten da sind — vorher Fallback auf Heuristik.

## Nicht-Ziele (bewusst draußen)

- Kein LLM-im-Loop.
- Kein laufendes Geschmacks-Feedback pro Essen (verworfen zugunsten statischem Rezept-Rating).
- Kein statistisches Modell jenseits EWMA/Median.
- Kein Überschreiben manuell gesetzter Baselines (`rhythm` bleibt sichtbar/gültig).
- Keine Vorschläge ohne Datengrundlage (immer Heuristik-Fallback).
- Keine haushaltsübergreifende Generalisierung.
