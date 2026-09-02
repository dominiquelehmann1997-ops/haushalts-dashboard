# Import im Hintergrund mit Benachrichtigung

Design vom 2026-09-02. Betrifft zwei Repos: `Rezept-Importer` (ObsidiDine,
Android) und `haushalts-dashboard` (Server).

Baut auf `2026-09-02-import-tempo-und-rezeptkategorien-design.md` auf — der
asynchrone Job und das Kategorie-Feld sind dort entstanden und werden hier
vorausgesetzt.

## Ausgangslage

Seit dem asynchronen Umbau läuft die Extraktion serverseitig im Hintergrund:
`POST /api/recipes/parse` mit `async: true` antwortet in 0,11 s mit einer
Job-Id, jeder Poll dauert 0,03 s. Der Job läuft weiter, auch wenn niemand
zuhört.

**Die App tut das trotzdem nicht.** Sie hält den Bildschirm offen und pollt,
bis das Rezept fertig ist — bei einer Rezeptkarte 33 bis über 90 Sekunden. Wer
die App in dieser Zeit schließt, verliert das Ergebnis, obwohl der Server es
fertigstellt.

Am 2026-09-02 kam dazu ein abgebrochener Import mit „claude CLI Timeout nach
90s": das Extraktionsbudget stammte noch aus der Zeit, als Cloudflare und der
Client mitgerechnet werden mussten. Das ist separat auf 240 s korrigiert und
ausgerollt (`d984704`) und nicht Teil dieses Designs.

## Entscheidungen

Am 2026-09-02 mit dem Nutzer festgelegt:

1. **Die Benachrichtigung erzeugt die App selbst**, lokal auf dem Gerät, über
   WorkManager — kein Web-Push. Begründung: sie soll auf dem Handy erscheinen,
   das geteilt hat. Web-Push kennt nur Personen und Abos, nicht das auslösende
   Gerät; ObsidiDine hat zudem gar kein eigenes Push-Abo (das gehört der
   Dashboard-PWA, einer anderen App). Lokal erzeugt ist die richtige Zustellung
   **bauartbedingt** und nicht konfiguriert.
2. **Das Abnicken bleibt.** Nichts landet ungefragt in der Datenbank. Die
   Benachrichtigung führt in die Vorschau, erst das Speichern dort schreibt.
   Der Preview-Editor der App bleibt damit vollständig erhalten.
3. **Mehrere Importe gleichzeitig sind erlaubt**, werden auf dem Server aber
   **seriell abgearbeitet**. Siehe Abschnitt „Mehrere Importe".
4. **Fehlschlag meldet nur den Grund.** Kein Wiederholen-Knopf, kein
   gespeicherter Wiederholungszustand — neu teilen ist eine Geste.

## Teil 1 — Server

Der Vertrag von `POST /api/recipes/parse` und `GET /api/recipes/parse?job=`
bleibt **unverändert**. Es wird weiterhin nur extrahiert, nie gespeichert;
gespeichert wird ausschließlich über `POST /api/recipes/import`, nachdem der
Nutzer abgenickt hat.

Zwei Änderungen in `web/src/lib/services/importJobs.ts` bzw. der Route:

**Serielle Abarbeitung.** Ein neuer Import darf jederzeit angenommen werden
(`202` sofort), aber es läuft immer nur eine Extraktion. Umsetzung als
Promise-Kette im Modul-Scope: jeder neue Hintergrundlauf hängt sich an das Ende
der vorigen an.

Begründung, gemessen am 2026-09-02 auf dem Tablet: 7,4 GB RAM, davon 2,2 GB
verfügbar, **Swap zu 80 % belegt** (3,0 von 3,7 GB). `next-server` ist mit
194 MB der größte Prozess und damit erster Kandidat, wenn Android unter Druck
aufräumt. Ein `claude`-Prozess wiegt ~126 MB. Drei parallel wären
wahrscheinlich verkraftbar — aber der Preis eines abgeschossenen Servers ist
höher als der Preis, dass die dritte Benachrichtigung später kommt.

**Haltezeit auf 60 Minuten.** `JOB_TTL_MS` steigt von 10 auf 60 Minuten. Die
10 Minuten waren auf einen wartenden Client zugeschnitten; jetzt können Stunden
zwischen Fertigstellung und dem Antippen der Benachrichtigung liegen. Der
Worker legt das Ergebnis zwar lokal ab (siehe Teil 2), aber zwischen
Fertigstellung und Abholung durch den Worker darf der Job nicht verfallen.

## Teil 2 — App

### Teilen

`ShareActivity` schrumpft auf: Quelltext einsammeln (OCR, Caption, Link) →
`POST` mit `async: true` → Job-Id → `OneTimeWorkRequest` einreihen → kurzer
Hinweis „An Cockpit übergeben" → `finish()`.

Kein Wartebildschirm, kein Sekundenzähler, kein Polling im Vordergrund.

### `DashboardClient` wird aufgeteilt

`parse(text, sourceUrl)` macht heute beides in einem Aufruf: Job starten **und**
pollen, bis das Rezept da ist. Das geht nicht mehr auf, wenn das Starten in der
Activity und das Pollen im Worker passiert. Die Methode zerfällt deshalb in
zwei:

- `startParse(text, sourceUrl): String` — schickt den `POST` mit `async: true`
  und gibt die Job-Id zurück.
- `pollJob(jobId): JobResult` — ein einzelner `GET`; das Warten und Wiederholen
  gehört dem Worker, nicht dem Client. `JobResult` ist
  `Pending | Done(draft) | Failed(message) | Gone`.

Damit entfällt `MAX_POLL_MS` im Client ersatzlos — die Obergrenze ist jetzt die
des Workers. `pollDelayMs` aus dem vorigen Umbau entfällt ebenfalls; ohne
Warteschleife im Client gibt es nichts mehr zu verzögern. Die zugehörigen Tests
wandern mit.

`save(draft)` bleibt unverändert.

### Der Worker

Neu: `ImportStatusWorker`, ein `CoroutineWorker`. Abhängigkeit
`androidx.work:work-runtime-ktx:2.11.2` (aktuellste stabile Version laut
Googles Maven-Metadaten, am 2026-09-02 geprüft; verlangt `compileSdk 35`, das
Projekt steht auf 35).

Er bekommt Job-Id, Dashboard-Adresse, Token und die beiden optionalen
Cloudflare-Felder als `inputData`. Er pollt `GET /api/recipes/parse?job=<id>`
alle 5 Sekunden, höchstens 5 Minuten, mit `NetworkType.CONNECTED` als
Constraint.

Ergebnis:

| Job-Status | Verhalten |
| --- | --- |
| `done` | Entwurf **lokal ablegen**, dann Benachrichtigung „Rezept fertig: *Name* — antippen zum Prüfen" |
| `error` | Benachrichtigung mit der Servermeldung im Klartext |
| `404` / Job weg | Benachrichtigung „Import unklar — bitte erneut teilen" |
| 5 Minuten ohne Ergebnis | `Result.retry()`; nach dem letzten Versuch dieselbe „unklar"-Meldung |

Das lokale Ablegen ist der Kern: **danach ist die Benachrichtigung unabhängig
davon, ob der Job auf dem Server noch existiert.** Ohne diesen Schritt hinge
die Vorschau an einer Haltezeit, die der Nutzer nicht kennt.

### Prüfen und Speichern

Ein Tipp auf die Benachrichtigung öffnet `ShareActivity` erneut, diesmal mit
der Job-Id als Intent-Extra statt eines Share-Intents. Sie lädt den lokal
abgelegten Entwurf und zeigt die vorhandene Vorschau. Kein neuer Bildschirm,
keine zweite Activity — derselbe Editor, nur ein anderer Einstieg.

Fehlt der lokale Entwurf (App neu installiert, Daten gelöscht), wird einmal der
Server gefragt; ist auch dort nichts mehr, erscheint „Import abgelaufen — bitte
erneut teilen".

Abnicken ruft wie bisher `POST /api/recipes/import`. Danach wird der lokale
Entwurf gelöscht und die Benachrichtigung entfernt.

### Berechtigung

`POST_NOTIFICATIONS` ins Manifest, Laufzeitabfrage ab Android 13 (`targetSdk`
steht auf 35, die Abfrage ist damit Pflicht). Gefragt wird in `MainActivity`
beim Öffnen der Einstellungen, nicht im Share-Ablauf — dort wäre ein Dialog
mitten im Teilen-Vorgang störend.

Wird die Berechtigung verweigert, läuft der Import trotzdem durch und das
Rezept ist über die Vorschau erreichbar, sobald die App wieder geöffnet wird;
nur die Benachrichtigung entfällt. Ein Hinweis in den Einstellungen sagt das.

## Mehrere Importe

Serverseitig entsteht je Import ein eigener Job; die serielle Warteschlange
arbeitet sie nacheinander ab. Für den Nutzer fühlt es sich parallel an: drei
Rezepte hintereinander abfeuern geht, die App ist jedes Mal sofort wieder weg.

In der App braucht das drei Änderungen, sonst überschreiben sich zwei Importe
gegenseitig:

1. **Entwürfe je Job.** Der SharedPreferences-Schlüssel `draft_json` wird zu
   `draft_<jobId>`. Beim Speichern oder Verwerfen wird nur der eine Eintrag
   gelöscht. Ein Aufräumen entfernt Einträge, die älter als 7 Tage sind — sonst
   wächst der Speicher mit jedem nie abgenickten Import.
2. **Benachrichtigungs-Ids** leiten sich aus der Job-Id ab (`jobId.hashCode()`),
   damit mehrere nebeneinander stehen bleiben statt sich zu ersetzen.
3. **Eindeutige Work-Namen** je Job, damit WorkManager die Läufe nicht
   zusammenfasst.

## Grenzen, die bewusst bleiben

- **„Beenden erzwingen"** in den Android-Einstellungen stoppt WorkManager, bis
  die App wieder geöffnet wird. Der Job läuft serverseitig weiter, die
  Benachrichtigung kommt aber erst später oder gar nicht.
- **Akku-Optimierung** kann den Worker um Minuten verzögern.
- **Ein nie abgenicktes Rezept ist weg.** Es steht in keiner Datenbank — das
  ist der Preis des Abnickens.
- **Ein lokal abgelegter Entwurf überlebt keine Deinstallation.**
- Ein Import, der länger als 5 Minuten braucht, meldet „unklar", obwohl er
  serverseitig noch laufen kann. Bei einem Budget von 240 s ist das
  ausreichend Reserve.

## Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Kein Text gefunden (OCR leer) | Wie bisher sofort in der App, ohne Job |
| Dashboard nicht eingerichtet | Wie bisher sofort in der App |
| Extraktion scheitert | Benachrichtigung mit der Servermeldung |
| Job abgelaufen, Entwurf lokal vorhanden | Vorschau öffnet trotzdem — der lokale Entwurf genügt |
| Job abgelaufen, kein lokaler Entwurf | „Import abgelaufen — bitte erneut teilen" |
| Speichern scheitert | Wie bisher: Dialog, Vorschau bleibt mit den Bearbeitungen stehen |
| Benachrichtigung verweigert | Import läuft, Rezept über die App erreichbar |

## Tests

Vitest im Dashboard:

- Warteschlange: zwei gleichzeitig gestartete Jobs laufen nacheinander, nicht
  überlappend; beide erreichen `done`.
- Ein Fehlschlag im ersten Job blockiert den zweiten nicht.
- `JOB_TTL_MS` beträgt 60 Minuten und der Verfall greift weiterhin.

Kotlin im Rezept-Importer:

- `ImportStatusWorker` bei `done`: legt den Entwurf unter `draft_<jobId>` ab.
- Bei `error`: keine Ablage, Meldung enthält den Servertext.
- Bei `404`: „unklar"-Zweig.
- Zwei Entwürfe mit verschiedenen Job-Ids überschreiben sich nicht.
- Aufräumen entfernt Einträge älter als 7 Tage und lässt jüngere stehen.

Der Worker wird mit `TestListenableWorkerBuilder` und `MockWebServer` geprüft;
Benachrichtigungen selbst werden nicht getestet, sondern hinter eine schmale
Schnittstelle gelegt, die im Test durch eine Attrappe ersetzt wird.

## Reihenfolge

1. **Server** — Warteschlange und Haltezeit. Unabhängig, sofort ausrollbar.
2. **App: Ablage je Job** — Schlüssel, Aufräumen, Benachrichtigungs-Ids.
   Fundament für alles Weitere.
3. **App: Worker und Benachrichtigung** — inklusive Abhängigkeit und
   Berechtigung.
4. **App: Teilen ohne Warten** — `ShareActivity` umbauen, Einstieg über die
   Job-Id.

Nach Schritt 4 ist ein echter Import über die App zu fahren: teilen, App
schließt sich, Benachrichtigung abwarten, antippen, prüfen, speichern.

## Bewusst nicht gebaut

- Kein Web-Push, kein Server-seitiges Benachrichtigen.
- Kein Wiederholen aus der Benachrichtigung heraus.
- Keine Übersicht laufender Importe in der App.
- Kein automatisches Speichern ohne Abnicken.
- Keine Fortschrittsanzeige — die Benachrichtigung ist das Signal.
