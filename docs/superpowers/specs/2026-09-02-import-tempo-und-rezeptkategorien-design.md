# Import-Tempo und Rezept-Kategorien

Design vom 2026-09-02. Betrifft zwei Repos: `haushalts-dashboard` (Server, UI)
und `Rezept-Importer` (ObsidiDine, Android).

## Ausgangslage

Der Rezeptimport über ObsidiDine läuft seit dem 2026-09-01 (siehe
`plans/2026-08-26-rezeptimport-ueber-dashboard.md`), hat aber zwei Mängel:

**Tempo.** Gemessen am 2026-09-01 auf dem Tablet, jeweils über
`POST /api/recipes/parse`:

| Eingabe | Dauer |
| --- | --- |
| Mini-Rezept (130 Zeichen) | 6,6 s |
| Rezeptkarte (1734 Zeichen) | 42 s |
| Echter Import aus der App | 71 s |

Der CLI-Start ist damit als Ursache ausgeschlossen — sonst wäre auch das
Mini-Rezept langsam. Die Zeit ist Modell-Generierung und skaliert mit der
Ausgabemenge: das Modell schreibt jeden Zubereitungsschritt neu, übersetzt
und rechnet Einheiten um.

Die App blockiert währenddessen mit einem Spinner. Schlimmer: ein einzelner
HTTP-Request von 71 s liegt gefährlich nah an den ~100 s, nach denen die
Cloudflare-Edge abbricht. Genau daran ist am 2026-09-01 ein Import mit
`HTTP 502` gescheitert.

**Kategorien.** Die Rezept-DB kennt nur Hauptmahlzeiten. Snacks und Süßes
landen im selben Topf und damit im Wochenplan.

## Entscheidungen

Am 2026-09-02 mit dem Nutzer festgelegt:

1. **Kategorie als festes Feld**, nicht über die freien Tags. Der Wochenplan
   braucht einen harten Filter; bei einer Namenskonvention kippt ein
   Tippfehler den Plan still.
2. **Job-Zustand im Speicher**, nicht in der DB. Ein Import lebt eine Minute.
   Eine Tabelle dafür hieße Migration auf dem Android-Tablet für Daten, die
   danach wertlos sind.
3. **Prompt hart kürzen**, inklusive knapperer Schritt-Texte. Nur das senkt
   die Ausgabemenge und damit die Zeit.
4. **Snacks nur als Filter** in der Rezeptliste, kein eigener Dashboard-Bereich.

## Teil 1 — Extraktions-Prompt kürzen

Betrifft `web/src/lib/services/recipeExtract.ts`.

Der Prompt wurde an HelloFresh-Karten und Instagram-Captions getunt. Der
Nutzer importiert inzwischen praktisch nur noch Instagram-Rezepte. Damit
entfallen ersatzlos:

- die Portionsspalten-Regel (`2P`/`3P`/`4P`, „kleinste Portion nehmen"),
- die Schritt-Sortierregel für mehrspaltig gescannte Karten (3×2-Raster,
  spaltenweise gruppierter OCR-Text),
- der Selbstprüfungs-Absatz am Ende („Prüfe vor dem Antworten selbst …"),
- das ausführliche Beispiel im Zutaten-Gruppen-Abschnitt (die Regel bleibt,
  nur die drei Beispielzeilen fallen weg).

Geändert wird eine Regel: Schritte kommen künftig **knapp, ein bis zwei Sätze
je Schritt** statt „als vollständige Sätze". Das ist der einzige Punkt, der
die Ausgabemenge senkt — und damit der einzige, der wirklich Sekunden bringt.

Unverändert bleiben: Übersetzen ins Deutsche, metrische Umrechnung,
Zutaten-Gruppen (`section`), Trennung von `amount` und `unit`, die
Nährwert-Regeln inklusive „niemals schätzen" und „Bezugsgröße wörtlich".

**OCR bleibt vollständig erhalten.** Gestrichen werden nur Regeln für den
Sonderfall mehrspaltiger Rezeptkarten; Screenshots von Captions sind
einspaltig und brauchen sie nicht.

Neu im Ausgabeformat: `"category"` (siehe Teil 3).

**Erwartung, ehrlich beziffert:** 20-40 % weniger Zeit. Kein Vielfaches. Der
Gewinn wird an derselben Rezeptkarte vorher/nachher gemessen und im
Abschlussbericht als Zahl genannt, nicht geschätzt.

## Teil 2 — Asynchroner Import

### Protokoll

`POST /api/recipes/parse` bleibt in seiner heutigen Form erhalten (synchron,
antwortet mit `{ok, recipe}`) und bekommt ein optionales Feld im Body:

```
POST /api/recipes/parse   { "text": …, "sourceUrl": …, "async": true }
  → 202 { "ok": true, "jobId": "<uuid>" }

GET  /api/recipes/parse?job=<uuid>
  → 200 { "ok": true, "status": "pending" }
  → 200 { "ok": true, "status": "done",  "recipe": { … } }
  → 200 { "ok": true, "status": "error", "error": "…" }
  → 404 { "ok": false, "error": "Job unbekannt oder abgelaufen." }
```

Beide Verben liegen in derselben Datei
`web/src/app/api/recipes/parse/route.ts` und laufen durch dasselbe
`checkImportToken` — es entsteht kein neuer Endpunkt, der eigene Absicherung
bräuchte.

Der Status kommt als Feld im Body, nicht als HTTP-Code: ein laufender Job ist
kein Fehler, und `DashboardClient` wirft heute schon bei jedem non-2xx.

### Job-Speicher

Neu: `web/src/lib/services/importJobs.ts`.

- `Map<string, ImportJob>` im Modul-Scope, `ImportJob = { status, recipe?,
  error?, createdAt }`.
- `createJob()` legt an und gibt die Id (`crypto.randomUUID()`).
- `readJob(id)` liest; `finishJob` / `failJob` schreiben das Ergebnis.
- **Aufräumen beim Zugriff**, nicht per Timer: jede Lese- oder Schreiboperation
  entfernt Einträge älter als 10 Minuten. Ein `setInterval` in einem
  Next-Modul überlebt Hot-Reloads schlecht und hält den Prozess wach.
- Der Job wird nach dem ersten erfolgreichen Abruf von `done`/`error` **nicht**
  gelöscht — die App könnte die Antwort verlieren und erneut fragen. Die TTL
  räumt auf.

Die Extraktion läuft als nicht abgewarteter Promise weiter, während die Route
schon geantwortet hat. Das trägt, weil `next start` ein einzelner Prozess ist;
ein Kommentar in `importJobs.ts` hält fest, dass mehrere Worker den Ansatz
brechen würden.

### App

`DashboardClient.parse()` startet künftig den Job und pollt:

- `POST` mit `async: true` → `jobId`,
- danach `GET` alle 2 s bis `done` oder `error`,
- clientseitige Obergrenze 150 s, dann `DashboardException` mit klarer
  Meldung.

`ImportState.Working` bekommt die verstrichene Sekundenzahl, damit sichtbar
ist, dass etwas passiert.

Die OkHttp-Timeouts aus dem Fix vom 2026-09-01 bleiben, verlieren aber ihre
Schärfe: jede einzelne Anfrage dauert jetzt Millisekunden.

**Der eigentliche Gewinn ist nicht das Tempo, sondern der Wegfall des
Zeitlimits.** Kein Request läuft mehr gegen die ~100 s der Cloudflare-Edge.
Der `HTTP 502` vom 2026-09-01 kann strukturell nicht wiederkehren.

## Teil 3 — Kategorien

### Schema

```prisma
category String @default("hauptmahlzeit")
```

Werte: `hauptmahlzeit` | `snack` | `suesses`. Typ in `web/src/lib/domain`:
`RecipeCategory`.

Der Default sorgt dafür, dass alle bestehenden Rezepte Hauptmahlzeiten
bleiben — der Wochenplan verhält sich unmittelbar nach der Migration wie
vorher.

### Migration auf dem Tablet

`prisma migrate` läuft auf Android nicht (`unknown OS android`), und die
Tablet-DB hat keine `_prisma_migrations`-Historie. Deshalb wie schon bei
`carbs`/`fat` (siehe `tablet-remote-access.md`):

```sql
ALTER TABLE Recipe ADD COLUMN category TEXT NOT NULL DEFAULT 'hauptmahlzeit';
```

direkt über `better-sqlite3`, ausgeführt aus `web/`. Danach zwingend
`node_modules/.bin/prisma generate` — **nicht** `npx prisma generate`, das
scheitert auf arm64 und zwar still: Build und Server laufen anschließend mit
einem veralteten Client weiter, in dem die neue Spalte fehlt. Gegenprobe nach
dem Generieren:

```
grep -c "category" web/src/generated/prisma/models/Recipe.ts
```

### Wo gefiltert wird

Zwei Stellen ziehen den Rezept-Pool für die Planung und bekommen
`category: "hauptmahlzeit"` in die `where`-Klausel:

- `web/src/lib/services/mealPlanner.ts` — `generateWeekPlan`
- `web/src/lib/services/mealDraft.ts` — Neuwürfeln eines Tages

Dazu `listRecipeOptions` in `web/src/lib/repositories/recipes.ts`: das
Dropdown zum manuellen Setzen eines Tages zeigt künftig ebenfalls nur
Hauptmahlzeiten. Wer bewusst etwas Süßes einplanen will, ändert vorher die
Kategorie des Rezepts. (Vom Nutzer am 2026-09-02 so abgenommen.)

`listRecipes` (Rezeptliste) und `listAllRecipes` (Export) bleiben ungefiltert
— die Liste soll alles zeigen, das Backup erst recht.

### Oberfläche

- `web/src/components/mobile/RecipeFilterChips.tsx`: Kategorie-Chips neben den
  bestehenden Tag-Chips. `RecipeFilter` und `applyFilters`
  (`lib/services/recipeSearch.ts`) bekommen das Feld.
- Rezept-Formular (`rezepte/neu`, `rezepte/[id]/bearbeiten`): Auswahlfeld.
- ObsidiDine `PreviewScreen`: Dropdown neben dem Vegetarisch-Schalter,
  `RecipeDraft.category`.

### Import-Weg

`ImportedRecipe.category` wandert durch `recipeImport.ts`,
`toImportedFromExtraction`, die Import-Route und das Repository. Die
Extraktion rät die Kategorie (neue Prompt-Regel), der Nutzer korrigiert sie
im App-Preview vor dem Speichern. Ein unbekannter oder fehlender Wert fällt
auf `hauptmahlzeit` zurück — nie auf einen Fehler.

## Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Job-Id unbekannt oder abgelaufen | `404`, App meldet „Import abgelaufen, bitte erneut teilen" |
| Extraktion scheitert im Hintergrund | Job auf `error`, Meldung des Servers wird durchgereicht |
| Server-Neustart während eines Imports | Job weg → `404` → dieselbe Meldung wie oben |
| Polling überschreitet 150 s | App bricht ab, `DashboardException` |
| `category` unbekannt | still auf `hauptmahlzeit` |
| `RECIPE_IMPORT_TOKEN` fehlt | unverändert `503` auf beiden Verben |

## Tests

Vitest im Dashboard:

- `importJobs`: Anlegen, Lesen, Abschließen, TTL-Verfall, unbekannte Id.
- `parse`-Route: `async: true` liefert `202` + Id; `GET` liefert nacheinander
  `pending` und `done`; `GET` ohne Token `401`.
- `recipeExtract`: `category` wird gelesen und fällt bei Unfug zurück.
- `mealPlanner` / `mealDraft`: Snacks und Süßes tauchen im Plan nicht auf.
- `recipeSearch`: Kategorie-Filter.

Kotlin im Rezept-Importer (MockWebServer, wie `DashboardClientTest` es schon
tut):

- `parse()` startet den Job und pollt bis `done`.
- `error`-Status wird zur `DashboardException` mit Servermeldung.
- Abbruch nach Überschreiten der Obergrenze.

## Reihenfolge

1. **Kategorien** zuerst — das Schema zieht Prompt und Import mit; andersherum
   wären es zwei Migrationen.
2. **Prompt kürzen** — bringt die neue `category`-Regel gleich mit.
3. **Asynchroner Import** — hängt an nichts davon, kommt zuletzt.

Nach Schritt 2 wird gemessen (dieselbe Karte, vorher/nachher), damit der
Tempo-Gewinn belegt ist.

## Bewusst nicht gebaut

- Kein eigener Snack-Bereich im Dashboard.
- Keine Job-Historie, keine Wiederaufnahme nach Neustart.
- Kein Modellwechsel auf Haiku. Bleibt als Option, falls das Kürzen zu wenig
  bringt — dann als eigener, gemessener Versuch.
- Keine Push-Benachrichtigung bei fertigem Import. Die App pollt, solange sie
  offen ist; wer sie schließt, startet neu.
