# Design: Tablet-Betrieb + Chore-Import

**Datum:** 2026-06-12
**Status:** Entwurf zur Abnahme
**Ziel:** Das Haushalts-Dashboard läuft **lokal auf dem Google Pixel Tablet** und enthält die echten
Haushalts-Chores mit korrekten Intervallen, damit es im Alltag benutzt und getestet werden kann.

## Kontext

Heutiger Stand: Next.js-App unter `web/`, Prisma mit **better-sqlite3 Driver-Adapter**
(`@prisma/adapter-better-sqlite3`, siehe [db.ts](../../../web/src/lib/db.ts)), SQLite-Datei `dev.db`,
Vitest (217 Tests). Läuft bisher nur als `npm run dev` auf dem PC (:3001), kein öffentlicher Host,
kein Scheduler.

Entscheidender Punkt: Durch den Driver-Adapter nutzt Prisma **nicht** seine Rust-Query-Engine (der
übliche Android-Blocker). Das einzige native Modul ist `better-sqlite3`, das in Termux auf Android
(aarch64) per node-gyp baubar ist. Damit ist „Node-Server direkt am Tablet" realistisch ohne Rewrite.

## Gewählter Weg (Path A)

Termux-Node-Server am Tablet. Ganze App + Tests bleiben unverändert. Tablet-Chrome öffnet
`localhost:3001` und installiert die App als PWA (Vollbild). Server bindet `0.0.0.0`, damit der
**spätere** Handy-Zugriff im WLAN trivial wird.

## Non-Goals (diese Runde)

- Kein Cloud-Host (Vercel etc.), keine DB-Migration weg von SQLite.
- Kein Handy-Zugriff aufs Tablet einrichten (nur durch `0.0.0.0`-Binding vorbereitet).
- Kein dedizierter Home-Server / Raspberry Pi (spätere Entscheidung).
- Kein Service-Worker / Offline-Caching (Server ist lokal am selben Gerät → unnötig).
- Kein Verbrauchs-Tracking / Hundefutter-Vorrats-Rechner (als Follow-up dokumentiert, s.u.).

---

## Komponente 1 — Recurrence-Engine erweitern

Datei: [recurrence.ts](../../../web/src/lib/services/recurrence.ts). Heute kennt
`RHYTHM_OFFSET_DAYS` nur `daily:1, weekly:7, biweekly:14, 2x-week:3`; unbekannte rhythms fallen still
auf +7 zurück. Die Chore-Liste braucht zusätzlich `3-day`, `5-day`, `monthly`, `halfyearly`.

**Rhythmus-Vokabular (Ziel):**

| rhythm | Vorschub | Mechanik |
|---|---|---|
| `daily` | +1 Tag | Tages-Offset |
| `3-day` | +3 Tage | Tages-Offset |
| `5-day` | +5 Tage | Tages-Offset |
| `weekly` | +7 Tage | Tages-Offset (bestehend) |
| `biweekly` | +14 Tage | Tages-Offset (bestehend) |
| `2x-week` | +3 Tage | Tages-Offset (bestehend, bleibt für Rückwärtskompatibilität) |
| `monthly` | +1 Kalendermonat | Monats-Arithmetik (`setMonth`) |
| `halfyearly` | +6 Kalendermonate | Monats-Arithmetik (`setMonth`) |

**Design `nextDueDate(rhythm, from)`** bleibt pure (keine Mutation, keine DB):
1. Ist `rhythm` ein Monats-Rhythmus (`monthly`/`halfyearly`) → neuer `Date`-Klon, `setMonth(+n)`.
   Kalendertreu (12. → 12. nächster Monat), kein Drift über's Jahr.
2. Sonst Tages-Offset aus der Map; unbekannt → Default +7 (Verhalten **unverändert**).

**Edge-Case Monats-Arithmetik:** JS `setMonth` rollt bei kürzeren Monaten über (31. Jan + 1 Monat →
3. März). Für Haushalts-Chores akzeptabel; wird im Spec-Kommentar vermerkt. Keine Sonder-Clamp-Logik
(YAGNI), kann später nachgezogen werden.

**Tests:** je neuer rhythm ein `nextDueDate`-Test (inkl. Monats-Übergang über Jahresgrenze für
`halfyearly`, z.B. 12. Aug → 12. Feb). Bestehende Tests bleiben grün; `2x-week` und der
unknown-Default ändern sich **nicht**.

Keine DB-Migration nötig — `Task.rhythm` ist bereits ein freies `String?`-Feld.

---

## Komponente 2 — Chore-Import

Neues **idempotentes** Skript, getrennt vom zerstörenden Demo-Seed
([seed.ts](../../../web/prisma/seed.ts) bleibt unverändert für Tests/Fixtures).

- Datei-Vorschlag: `web/prisma/importChores.ts` mit einem Daten-Array + reiner Mapping-Funktion;
  npm-Script `import:chores`.
- **Idempotenz:** Upsert nach `Task.title`. `Task.title` ist nicht unique → Logik: pro Chore
  `findFirst({ where: { title } })`; existiert ein Task mit dem Titel, Felder aktualisieren statt
  Duplikat anlegen. So ist das Skript wiederholt ausführbar (z.B. nach Listen-Änderung).
- **Nicht zerstörend:** löscht keine anderen Tasks/Tabellen. Personen müssen existieren (vom Seed
  oder einem kleinen Person-Bootstrap) — Skript prüft und legt Dome/Emely/Baby an, falls leer.
- `effort` = Minuten (konsistent mit Seed: 5/15/25/30…).
- **Initiale Fälligkeit gestaffelt:** nicht alle 17 Tasks `dueDate = heute`. Deterministische
  Streuung: `dueDate = heute + (laufender Index modulo Intervall-Tage)` (Monats-Rhythmen: 0–6 Tage
  Streuung). Nach erster Erledigung übernimmt die Recurrence-Engine den echten Takt.
- **`allowedPersons`:** Default `"both"` für alle (vom Nutzer im Spec-Review pro Chore korrigierbar).

**Vollständiges Mapping (17 Tasks aus der Liste):**

| # | Titel | type | rhythm | effort | outdoor | weather | icon | Notiz/sub |
|---|---|---|---|---|---|---|---|---|
| 1 | Saugroboter starten | routine | daily | 2 | – | – | 🤖 | — |
| 2 | Bad putzen (groß) | routine | weekly | 30 | – | – | 🛁 | sub „groß" |
| 3 | Bad putzen (klein) | routine | weekly | 15 | – | – | 🚽 | sub „klein" |
| 4 | Treppe saugen | routine | 3-day | 5 | – | – | 🧹 | — |
| 5 | Rasen mähen | routine | weekly | 60 | ja | noRain | 🌱 | — |
| 6 | Wäsche waschen | routine | 5-day | 20 | – | – | 🧺 | „alle 5 Tage kontrollieren" |
| 7 | Küchenfronten putzen | routine | monthly | 30 | – | – | 🧽 | — |
| 8 | Sofa und Teppich absaugen | routine | 3-day | 10 | – | – | 🛋️ | — |
| 9 | Staub wischen | routine | weekly | 20 | – | – | 🪶 | — |
| 10 | Monty bürsten | routine | weekly | 15 | – | – | 🐕 | — |
| 11 | Gassi gehen | routine | daily | 45 | ja | **keine** | 🦮 | „möglichst vor Spätdienst" |
| 12 | Einkaufen | shopping | — (kein) | 50 | – | – | 🛒 | „nach Bedarf" |
| 13 | Hundefutter kaufen | shopping | — (kein) | 5 | – | – | 🦴 | „nach Verbrauch (Vorrats-Rechner später)" |
| 14 | Kühlschrank ausmisten + wischen | routine | monthly | 60 | – | – | 🧊 | — |
| 15 | Altglas wegbringen | routine | biweekly | 10 | – | – | ♻️ | — |
| 16 | Pfand wegbringen | routine | biweekly | 1 | – | – | 🥤 | „mit Einkauf verbinden" |
| 17 | Fenster putzen | routine | halfyearly | 90 | ja | noRain | 🪟 | „oben + unten aufteilen, je ≥1,5h/Geschoss" |

Hinweise:
- Gassi: `outdoor:true`, aber **ohne** `weatherCondition` → wird von `checkWeather` nie
  wetterbedingt verschoben (bestätigt: [weatherCheck.ts:73](../../../web/src/lib/engine/weatherCheck.ts#L73)).
- Einkaufen + Hundefutter: `type:"shopping"`, `rhythm:null` → keine Auto-Wiederholung (Wunsch).
  `type:"shopping"` existiert bereits im Modell.
- `weatherCondition` wird wie im Seed als JSON-String gespeichert: `{"noRain":true}`.

**Tests:** Mapping-Funktion ist pure → Unit-Test (richtige Felder pro Chore). Import-Idempotenz gegen
die Test-DB (zweimal ausführen → keine Duplikate, Felder aktualisiert).

---

## Komponente 3 — PWA-fähig machen

Damit Tablet-Chrome die App als Vollbild-App installiert:

- `web/public/manifest.webmanifest`: `name`, `short_name`, `start_url:"/"`, `display:"standalone"`,
  `background_color`, `theme_color`, `icons` (192px + 512px, plus `maskable`).
- Icons: aus einfachem SVG/Emoji generiert, in `web/public/` abgelegt.
- Next-Metadata in [layout.tsx](../../../web/src/app/layout.tsx): `metadata.manifest`,
  `themeColor`, `appleWebApp` (`capable:true`) und Viewport (`width=device-width, viewport-fit=cover`).
- **Kein Service-Worker.** Moderne Chrome-Versionen erlauben Installation mit Manifest allein; der
  Server läuft lokal am Gerät, Offline-Caching bringt nichts (YAGNI).
- Layout ist laut README bereits responsiv → ein gezielter Landscape-/Touch-Check am 11"-Tablet
  (Touch-Ziele groß genug, Hero-Band + Widget-Reihe in Querformat lesbar). Anpassungen nur, falls der
  Check etwas zeigt — kein spekulatives Redesign.

---

## Komponente 4 — Termux-Runbook

Doku `docs/tablet-termux-setup.md` + Helfer-Skript `scripts/tablet-start.sh`. Ablauf:

```sh
# Einmalige Einrichtung
pkg update && pkg install nodejs-lts git python clang make
git clone <repo> && cd <repo>/web
npm ci                                  # better-sqlite3 baut nativ (aarch64)
cp .env.example .env                    # DATABASE_URL=file:./dev.db (+ optional Google/Bring)
npx prisma migrate deploy
node node_modules/prisma/build/index.js generate
npm run import:chores
npm run build

# Start (auch via Autostart)
HOST=0.0.0.0 PORT=3001 npm start        # 0.0.0.0 → späterer Handy-Zugriff frei
termux-wake-lock                        # verhindert Doze während Server läuft
```

- **Autostart:** Termux:Boot-Skript ruft `tablet-start.sh` beim Geräte-Boot.
- **Wach bleiben:** `termux-wake-lock` + Android „Beim Laden aktiv lassen"; Tablet am Strom (Kiosk).
- **Optional schneller Build:** `.next` ist portabler JS → kann auf dem PC gebaut und aufs Tablet
  kopiert werden; nur `npm ci` (native Module) muss am Tablet laufen. Als Optimierung dokumentiert,
  Default ist Build am Tablet (einfacher, weniger Fehlerquellen).
- Abschluss: Chrome → `http://localhost:3001` → „Zum Startbildschirm hinzufügen / App installieren".

---

## Build-Reihenfolge

1. **Recurrence-Engine** erweitern (+ Tests).
2. **Chore-Import** (Mapping + Skript + Tests).
3. **PWA** (Manifest + Metadata + Layout-Check).
4. **Termux-Runbook** + Test am echten Tablet.

Jede Stufe ist für sich testbar; 1–3 sind reine App-Arbeit (Vitest bleibt grün), 4 ist
Doku/Skript + manueller Geräte-Test.

## Verifikation

- `npm test` (Vitest) bleibt grün; neue Tests für Recurrence + Import.
- Manuell am Tablet: Termux-Server startet, Chrome installiert PWA, Dashboard zeigt die 17 Chores,
  Erledigen einer Routine erzeugt korrekten Folgetermin im richtigen Intervall.

---

## Follow-ups / Out-of-scope (dokumentiert, nicht in dieser Runde)

- **Hundefutter-Vorrats-Rechner:** Hund bekommt täglich feste Menge. Idee: einmal Anfangs-Vorrat
  angeben → Dashboard rechnet `Resttage = Vorrat / Tagesmenge` → erzeugt/terminiert „Hundefutter
  holen", wenn Vorrat zur Neige geht. Nach Einkauf neuen Gesamtvorrat eingeben. Braucht später ein
  kleines Datenmodell (Tagesmenge, aktueller Vorrat, letzter Stichtag) + Berechnung beim Lesen.
- **Handy-Zugriff aufs Tablet** im WLAN (durch `0.0.0.0` vorbereitet, aber nicht eingerichtet).
- **Home-Server / Raspberry Pi** als dauerhafter Host (spätere Architektur-Entscheidung).

## Offene Punkte für den Nutzer-Review

- `allowedPersons` steht überall auf `"both"` — falls bestimmte Chores fix an Dome oder Emely
  gehören (z.B. Rasen, Gassi), hier markieren.
- Bad „groß" und „klein" sind beide `weekly` (wie in der Liste). Falls „groß" seltener sein soll
  (z.B. monatlich tiefenrein), anpassen.
- Icons/Emojis sind Vorschläge — Änderungswünsche willkommen.
