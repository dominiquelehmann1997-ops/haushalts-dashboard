# Kompakt-Dashboard fürs Tablet — Design

**Datum:** 2026-06-14
**Status:** Abgenommen (Brainstorming)
**Kontext:** Das Dashboard läuft am Pixel Tablet (Termux, Querformat). Aktuell stapeln
sich 8 Kacheln + 2 Leisten → Scrollen nötig. Ziel: **eine Screen, kein Scroll**,
ruhig und auf einen Blick erfassbar.

## Ziel & Leitidee

Das Tablet ist ein **Anzeige- und Abhak-Gerät** an der Wand/im Dock. Es zeigt den
Tag auf einen Blick und erlaubt genau **eine** Art Interaktion: Aufgaben abhaken,
aufschieben, nachtragen. Alles Pflegen/Planen (Essensplan würfeln/abnicken,
Notizen schreiben, Einkauf) passiert später in der **Handy-App** (eigenes Projekt,
direkt im Anschluss). Dieses Layout wird **die** Dashboard-Ansicht — kein zweites
Layout pflegen; es bleibt responsiv genug, um am Laptop nicht zu brechen.

## Technischer Ansatz

**Viewport-fixes CSS-Grid.** Wurzel-Container `100dvh`, `overflow: hidden` → **keine
Seiten-Scrollbar**. Drei Höhenzonen (~15% / ~60% / ~22%, Rest Gaps). Kacheln mit
potenziell langem Inhalt (Aufgabenlisten, Essensplan, Notizen) scrollen **intern**
(`overflow-y: auto`), nie die Seite. Kein Auto-Scaling/Transform (fragil).
Optimiert für Querformat ~1600×1000 CSS-px; einspaltiger Fallback unter `sm` bleibt
für Laptop/Handvorschau erhalten.

## Layout (Querformat, 3 Zonen)

**Zone 1 — Topbar (~15%):**
- Links: Titel „Heute." + echtes Datum (`todayLabel`, bereits vorhanden).
- Mitte: Kennzahl-Chips aus dem bisherigen `WeekWidget` — „N offene Aufgaben",
  „Projekt X%". Kompakt, nicht-interaktiv.
- Rechts: **Wetter-Widget (detailliert)** — siehe unten.

**Zone 2 — Primär-Reihe (~60%, 4 Spalten):**
- **Aufgaben Dome** (interaktiv)
- **Aufgaben Emely** (interaktiv)
- **Termine heute** (read-only, bestehende `AppointmentsTile`)
- **Essensplan** (read-only Anzeige: heute + nächste Tage, bestehende
  `MealPlanWidget`)

**Zone 3 — Notiz-Band (~22%, volle Breite):**
- **Notizen read-only** (bestehende `NotesWidget`, ohne Eingabe). Hinweis-Label
  „Eingabe via Handy-App".

## Aufgaben-Interaktion (einziger Schreibpfad am Tablet)

- **Tippen** auf eine Aufgabe → erledigt / wieder offen (bestehende
  `toggleTaskAction`, optimistisch — unverändert).
- **Gedrückt halten** (Long-Press, ~500 ms) → Kontext-Menü direkt an der Aufgabe:
  - **Erledigt** (= toggle done)
  - **Aufschieben** → verschiebt auf den **nächsten sinnvollen Tag** (automatisch,
    siehe unten)
  - **Geht heute nicht** → Status `failed` mit Grund (bestehende `failTaskAction`;
    kurzer Grund-Dialog)
- **„+"-Button** im Personen-Header → **erledigt nachtragen** (spontan erledigte
  Aufgabe buchen; Logik aus bestehendem `AddDoneEntry`, pro Person).

### „Aufschieben" = automatisch sinnvoller Tag

Kein manueller Picker. Beim Aufschieben wird `dueDate` auf den nächsten passenden
Tag gesetzt und Status `moved`:
- Wiederkehrende Aufgaben: nächster Tag gemäß ihrem **Rhythmus** (`recurrence.ts`).
- Sonst/zusätzlich: erster Folgetag, an dem die Engine die Aufgabe als zuweisbar
  einstuft (Verfügbarkeit/Wetter über `planTask`).
- Fallback, wenn nichts gefunden: **+1 Tag**.
Implementierung detailliert der Plan; bevorzugt Wiederverwendung von
`engine/planTask` bzw. `recurrence.ts`, keine neue Heuristik erfinden.

## Wetter-Widget (detailliert, ohne Baby)

`CurrentWeather` trägt bereits `temp, label, detail, hi, lo, rainFrom, uvIndex`.
- **Neu:** Windgeschwindigkeit. `wind_speed_10m` zur Open-Meteo-`current`-Abfrage
  (`FORECAST_URL`-Query) hinzufügen, in `OpenMeteoResponse.current`,
  `mapCurrent` und `CurrentWeather` (`wind: number`) durchreichen. Fixture +
  Mapper-Test ergänzen.
- **Neue, schlanke `Weather`-Komponente** (ersetzt `WeatherBabyTile` auf dem
  Dashboard): Temp groß, Zustand, H/T, Regenfenster (`detail`/`rainFrom`),
  Wind, UV nur falls `uvIndex ≥ 3`. **Keine** Baby-Kleidungs-/UV-Beratung.

## Entfällt aus der Tablet-Ansicht

Aus `dashboard.tsx`/`page.tsx` nicht mehr gerendert (Code bleibt im Repo,
serverseitige Logik wie Bring-Push/Essensplan unberührt):
- `WeatherBabyTile` (Baby-Alter/Kleidung) → ersetzt durch `Weather`.
- `ShoppingWidget` + `FreshShoppingControl` (Einkauf → Bring/Handy-App).
- `ElternzeitStripe` (Fairness/Elternzeit-Leiste).
- `MealDraftPanel` + `VaultIngestControl` (Essensplan-Planung/Admin → Handy-App).
- `AddDoneEntry` als eigene Leiste → ersetzt durch „+" pro Personen-Kachel.
- „Mock-Demo"-Footer.

Entsprechende Props (`fresh`, `draft`, `recipes`, `split`, `phase`, `babyAgeBand`,
`babyAgeLabel`) entfallen aus `DashboardProps`/`page.tsx`, soweit nicht mehr genutzt.

## Komponenten-Schnitt

- `dashboard.tsx` — neuer Viewport-Grid-Shell (3 Zonen), nur noch genutzte Props.
- `Weather` (neu) — reines Wetter, ersetzt `WeatherBabyTile`.
- `TaskTile` (bestehend, erweitert) — Long-Press-Menü + „+"-Header; Tap unverändert.
- `TaskActionMenu` (neu, klein) — Popover „Erledigt / Aufschieben / Geht nicht".
- Topbar-Kennzahl-Chips — aus `WeekWidget` extrahiert/kompaktiert.
- Server-Action `deferTaskAction` — erweitert um „nächster sinnvoller Tag" + `dueDate`.

## Testing

- Mapper-Test: `mapCurrent` liefert `wind` aus Fixture.
- „Aufschieben"-Logik: pure Funktion „nächster sinnvoller Tag" unit-getestet
  (Rhythmus-Fall, Engine-Fall, Fallback +1).
- `deferTaskAction`: setzt Status `moved` + neues `dueDate` (Repo-Test).
- Bestehende 237 Tests bleiben grün; entfernte Komponenten-Tests nur, wenn die
  Komponente nicht mehr existiert (Komponenten bleiben aber im Repo → Tests bleiben).

## Out of Scope (Folge-Projekt Handy-App)

Essensplan würfeln/abnicken, Notizen-Eingabe, Einkauf-Pflege, Fairness-Ansicht,
Baby-Kleidungsberatung. Alles bewusst aufs Handy verlagert.
