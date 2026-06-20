# Google Kalender — Termine, intelligente Verteilung & Sync — Design

**Datum:** 2026-06-20
**Status:** Abgenommen (Brainstorming)
**Kontext:** Phase 4 (Google-Kalender-Anbindung) ist im Code komplett vorhanden und
getestet — OAuth-Flow, Sync-Route, Mapper, `CalendarEvent`-Modell, `AppointmentsTile`
und die Verteil-Engine (`planTask` + `getBusyWindows` inkl. Schicht-Korrektur). Real
*wirkt* es trotzdem nicht: Termine sind veraltet und beeinflussen die Aufgaben-Verteilung
gar nicht. Dieses Design schließt die drei Lücken, die das verhindern, plus einen
manuellen Sync-Button.

## Bestandsaufnahme (was schon da ist)

- **OAuth verbunden:** Refresh-Token liegt in `OAuthToken` (`provider: "google"`),
  Consent lief ~08.06.2026. Verbindung steht.
- **Sync-Route** `GET|POST /api/sync/calendar`: zieht 14 Tage aus den 6 konfigurierten
  Kalendern (`fetchEvents`) und upsertet sie (`upsertEvents`).
- **`.env` voll:** echte `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` + alle 6
  `GOOGLE_CALENDAR_*`-IDs.
- **Anzeige:** `AppointmentsTile` rendert `getTodaysEvents` — korrekt, kein Umbau nötig.
- **Engine:** `planTask` filtert u.a. über `filterByAvailability(persons, window, busy)`;
  `getBusyWindows` baut die `BusyWindow[]` aus Kalender-Events inkl. Nacht/LN-Korrektur
  (busy bis 14:00 Folgetag).

## Die drei Lücken (Ist-Zustand)

1. **Kein Auto-Sync.** Sync lief 1× (~08.06), nur **3 alte Events** in der DB, das
   14-Tage-Fenster ist abgelaufen. `scripts/tablet-start.sh` ruft `plan:today`, aber
   **nie** den Kalender-Sync. → Termine veraltet/leer.
2. **Verteilung nutzt Termine nicht.** `prisma/planToday.ts` ruft `planDueTasks(day)`
   **ohne** `busy` (und ohne `forecast`). Zusätzlich haben Tasks `window: undefined` →
   `filterByAvailability` lässt ohnehin alle durch. Das Plumbing existiert, ist aber tot.
   Termine haben heute **null** Einfluss auf die Zuteilung. (Forecast/Wetter-Deferral ist
   aus demselben Grund tot.)
3. **Kein manueller Anstoß.** Sync nur über direkten Aufruf der HTTP-Route; keine
   Bedien-Möglichkeit aus den UIs.

---

## A) Auto-Sync

**Sync-Kern extrahieren.** Neuer Service `src/lib/services/calendarSync.ts` mit
`syncCalendar(client?)`: bündelt die heute in der Route liegende Logik — konfigurierte
Kalender ermitteln, 14-Tage-Fenster, `fetchEvents` je Kalender, `upsertEvents`. Gibt die
Anzahl gesyncter Events zurück (oder wirft klare Fehler: „nicht verbunden" / Netz).
- Route `/api/sync/calendar` wird auf diesen Kern reduziert (ruft `syncCalendar()`,
  verpackt Ergebnis/Fehler als JSON). Keine Logik-Dopplung.

**CLI-Script.** `prisma/syncCalendar.ts` + `npm run sync:calendar` (tsx, `dotenv/config`),
ruft `syncCalendar()` und loggt das Ergebnis. Schreibt direkt in dieselbe sqlite-DB —
läuft auch parallel zum laufenden Server (WAL).

**Startreihenfolge.** `scripts/tablet-start.sh`: `npm run sync:calendar` **vor**
`npm run plan:today`, beide mit `|| true` (Fehler darf Start nicht blockieren). So sieht
der Morgen-Plan frische Termine.

**Periodisch (stündlich).** `scripts/tablet-sync.sh` → `sync:calendar` danach
`plan:today`. Eingehängt via Termux (`termux-job-scheduler`, ~60 min). Idempotent,
gefahrlos wiederholbar. Termine nie älter als ~1 h.

## B) Termine in die Verteilung verdrahten (Hybrid Tageskapazität)

**Leitidee:** Tasks haben nur einen Tag, keine Uhrzeit. Termine/Schichten haben
Uhrzeiten. Statt Tasks Zeitfenster zu geben, messen wir pro Person die **Tageskapazität**:
welcher Anteil des *aktiven Tages* (**08:00–22:00**) ist durch Termine/Schichten belegt.

### B1 — Neues pures Modul `src/lib/engine/capacity.ts`

`dayLoad(busy, activeWindow): Record<PersonKey, number>`
- Pro Person: deren `BusyWindow[]` auf `activeWindow` clippen, **überlappende Fenster
  mergen** (keine Doppelzählung), belegte Dauer summieren, durch Fensterlänge teilen →
  Anteil **0…1**.
- Pur (kein db/next/prisma), unit-getestet. `activeWindow` = lokal 08:00–22:00 des
  Plan-Tages.
- Quelle der `busy`: bestehende `getBusyWindows` (inkl. Nacht→14:00-Korrektur). Eine
  Nachtschicht deckt 08:00–14:00 → load ≈ 0,43 für den Folgetag; ein Ganztags-Termin → 1,0.

### B2 — `planTask` erweitern

Reihenfolge unverändert bis nach `filterByAvailability`. Danach neu, gesteuert durch
`dayLoad` (neues optionales Feld an `PlanInput`, z.B. `dayLoad?: Record<PersonKey, number>`;
fehlt es, verhält sich alles wie heute):

- **Harte Sperre:** Person mit `load ≥ 0,80` (Nachtschicht, Ganztags-Termin, fast voller
  Tag) wird aus den Kandidaten entfernt.
- **Beide voll:** bleibt nach der Sperre niemand übrig →
  `{ kind: "unassignable", reason: "beide ganztägig belegt" }`. Task bleibt offen +
  sichtbar, wird **nicht** still verworfen.
- **Teilbelegung → weicher Bias:** verbleibende Kandidaten gehen in die Fairness-Auswahl,
  aber das Defizit jeder Person wird mit `(1 − load)` skaliert. Eine halb belegte Person
  wirkt „ausgelasteter" → seltener gewählt; Arbeit wandert zum Freieren, ohne harte Sperre.

**Schwellen** (Konstanten, oben im Modul): `ACTIVE_DAY = 08:00–22:00`, `FULL_THRESHOLD = 0.8`.

### B3 — `selectByFairness` erweitern

Optionaler Parameter `loadPenalty?: Record<PersonKey, number>` (Anteil 0…1). Wenn gesetzt,
wird beim Sortieren das Defizit jeder Person mit `(1 − loadPenalty[person])` multipliziert,
bevor verglichen wird. Ohne den Parameter: identisches Verhalten wie heute (rückwärts­
kompatibel, bestehende Tests bleiben grün). Bleibt pur + testbar.

### B4 — Wire-up

- `prisma/planToday.ts`: holt `getBusyWindows(tagStart, tagEnd)` **und** `getForecast(...)`
  (über `@/integrations/weather/openMeteo`), übergibt beide an `planDueTasks(day, { busy,
  forecast })`. Netz-/DB-Fehler werden gefangen → Fallback `busy: []` / `forecast: []`
  (heutiges „keine Daten"-Verhalten).
- `src/lib/services/planning.ts` (`planDueTasks`): rechnet aus dem übergebenen `busy` via
  `dayLoad` das `dayLoad`-Objekt und reicht es pro Task an die Engine. Bleibt selbst
  netz-/kalenderfrei (Injection-Muster wie bisher).
- **Forecast-Bonus:** dieselbe Call-Site verdrahtet auch die bereits gebaute, aber tote
  Wetter-Deferral (Outdoor-Tasks bei Regen verschieben). Bewusst mitgenommen.

## C) Manueller Sync-Button (Handy + Tablet)

**Server-Action** `syncCalendarAction` (`src/app/.../actions` analog zu bestehenden
Actions): ruft `syncCalendar()` → danach `planDueTasks(heute, { busy, forecast })` →
`revalidateDashboard`. Eine Action für beide UIs. Fehler werden als Ergebnis
zurückgegeben (kein Throw über die UI-Grenze).

- **Tablet** (`src/components/dashboard.tsx`): kleiner Sync-Icon-Button in der Topbar
  (bei Datum/Wetter). Tippen → Action → Termine + Verteilung frisch. Kurzer Zustand
  (Spinner → Haken), fügt sich in die „eine Interaktion"-Linie des Tablet-Layouts ein.
- **Handy** (`(mobile)` Heute-Page, `PageHeader`): gleiches Icon, gleiche Action.
- **Verhalten:** Sync **+ Re-Plan** + Revalidate. Fehler (nicht verbunden / Netz) → kurzer
  Inline-Hinweis/Toast, kein Crash.

## Grenzen / Out of Scope

- **Idempotenz bleibt:** `planDueTasks` weist weiterhin nur **offene, unzugewiesene,
  standalone** Tasks zu. Stündliches Neu-Verteilen reißt nichts auseinander; manuelle und
  bereits zugeteilte Tasks bleiben unberührt.
- **Redistribution** bereits zugewiesener Tasks bei spontan eingetragenem Termin ist
  **out of scope** — bräuchte ein Auto-vs-Manuell-Tracking, das das Task-Modell nicht hat.
- **Tasks bekommen keine Uhrzeit** — die Tageskapazität ersetzt das bewusst (siehe
  Brainstorming-Entscheidung).
- **Anzeige-UI** (`AppointmentsTile`) unverändert; füllt sich durch Auto-Sync von selbst.

## Testing

- `dayLoad`: Überlappungs-Merge, Clip auf 08–22, Nachtschicht-Anteil, voll/leer.
- `selectByFairness` mit `loadPenalty`: Bias verschiebt Auswahl zum Freieren; ohne
  Parameter unverändert.
- `planTask`: `load ≥ 0,8` → Person raus; beide voll → `unassignable`; Teilbelegung →
  Bias greift; ohne `dayLoad` → Alt-Verhalten.
- `calendarSync`-Service: mit gemocktem `fetchEvents`/`upsertEvents` (kein echtes Netz),
  Fehlerpfad „nicht verbunden".
- `planDueTasks`: leitet `busy` → `dayLoad` → Engine korrekt durch (Repo-/Service-Test).
- Bestehende **237 Tests bleiben grün**.

## Umsetzung (Betriebsschutz)

Per `web/AGENTS.md`: Entwicklung **nur im git-Worktree**, isolierte `.env` + eigene
`dev.db`, **niemals** auf `main` / Prod-DB. Keine Migration berührt die Produktion (dieses
Design braucht ohnehin **keine** Schema-Änderung — alle Modelle existieren). Merge erst
nach grünen Tests und Neustart des Betriebs.
