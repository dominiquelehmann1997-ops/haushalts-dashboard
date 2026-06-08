# Haushalts-Dashboard — Umsetzungsplan

> **Für agentische Worker:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Schritt für Schritt umzusetzen. Schritte nutzen Checkbox-Syntax (`- [ ]`) zum Nachhalten.
>
> **Hinweis zur Granularität:** Dieses Dokument ist die **Roadmap mit klein geschnittenen, einzeln abnehmbaren Schritten und Abnahmekriterien** in der vom Auftraggeber gewünschten Reihenfolge. Es enthält bewusst **noch keinen Implementierungs-Code**, aber die **Design-Verträge** (Prisma-Schema-Felder, TypeScript-Schnittstellen, Test-Namen, Befehle), die für Review und Umsetzung nötig sind. Jede Phase wird **unmittelbar vor ihrer Umsetzung** per `writing-plans` in einen vollständigen TDD-Mikroplan (rot→grün-Code) ausgearbeitet.

**Goal:** Das bestehende Mock-Dashboard (`web/`) in ein voll funktionsfähiges Haushalts-Cockpit mit persistenter Datenhaltung, getesteter Verteil-Engine und echten Integrationen (Google Calendar, Wetter, Essensplan→Einkauf→Bring!) verwandeln — ohne den bestehenden Look zu verändern.

**Architecture:** Next.js 16 App Router als ein gemeinsamer Server mit lokaler SQLite-Datenbank (Prisma) als einziger Quelle der Wahrheit. Die Verteil-Engine ("Fairness-Konto") ist ein **reines, I/O-freies Logik-Modul** mit klar definierten Ein-/Ausgabe-Typen, vollständig per Vitest getestet. Ein Planungs-Service verbindet die Engine mit DB-Daten und externen Read-only-Quellen (Google Calendar, Open-Meteo). UI liest über Server Components, schreibt über Server Actions.

**Tech Stack:** Next.js 16.2.7 · React 19 · TypeScript (strict) · Tailwind v4 (alles bestehend) · Prisma + SQLite (`@prisma/adapter-better-sqlite3`) · Vitest (Tests) · Open-Meteo (Wetter, kein API-Key) · googleapis (Google Calendar, OAuth read-only) · Bring! (inoffiziell, nach Machbarkeits-Spike).

---

## Getroffene Grundsatz-Entscheidungen (mit Begründung)

| Thema | Entscheidung | Begründung |
|---|---|---|
| **Persistenz** | **SQLite via Prisma**, lokal, angesprochen über Server-Code | Vom Auftraggeber gewählt. Selbst-enthalten, kein Cloud-Konto, eine Datei. Prisma erlaubt späteren Wechsel auf Postgres/Supabase mit minimaler Änderung (nur `datasource`). |
| **Google Calendar** | **Getrennte Kalender pro Person** (Dome / Emely / ggf. Familie) | Vom Auftraggeber gewählt. Personen-Zuordnung ergibt sich eindeutig aus dem Quell-Kalender → saubere Verfügbarkeitsprüfung (Spec §5.4, §8). |
| **Testing** | **Vitest** (node-Environment für reine Logik) | Default. Schnell, TS-nativ, ideal für die TDD-getriebene Engine. Kein Framework-Lock-in mit Next.js. |
| **Wetter-API** | **Open-Meteo** | Default. Kostenlos, **kein API-Key**, liefert Niederschlag pro Stunde + Temperatur — genau die Eingaben, die der Wetter-Check der Engine braucht (Spec §5.2/§5.7). |
| **Kalender-/Wetter-Caching** | Kalender wird in DB **gespiegelt** (`CalendarEvent`); Wetter wird **live** geholt (Next-Cache) | Termine brauchen Engine **und** UI; periodischer Sync ist natürlich und macht das Tablet schnell/robust. Wetter ist volatil → Live-Fetch mit kurzer Revalidierung, kein DB-Tabellen-Overhead. |
| **Bring!** | **Machbarkeits-Spike zuerst** (Entscheidungs-Gate), dann Push **oder** Fallback | Spec §8: keine offizielle API. Erst Risiko klären, bevor Code geschrieben wird. |
| **Auth des Dashboards** | **Kein Login** auf dem Dashboard; **eine** geteilte Google-OAuth-Verbindung serverseitig | Geteiltes Wandtablet + Handy im selben Haushalt; Mental-Load-Ziel → keine Hürden. OAuth-Tokens nur serverseitig in `.env`/DB, nie im Client. |
| **Elternzeit-Verteilung** | Emely bleibt **verfügbar** (Kandidatin); Ziel **60/40** (Dome/Emely) statt Verfügbarkeits-Ausschluss | Auftraggeber-Entscheidung: Emely soll nicht *automatisch jede* Aufgabe bekommen, aber sehr wohl eingeplant werden können. Steuerung **allein** über das Fairness-Ziel. Weicht bewusst von Spec §9 (Auto-Nicht-Verfügbarkeit der betreuenden Person) ab. |
| **Hosting & Remote** | **Praxistest:** Next.js auf bestehendem **Windows-PC** + **Tailscale**. **Später:** **Raspberry Pi 5** always-on. **Anzeige:** **Pixel Tablet als PWA** (kein gesperrter Kiosk, da Mehrzweck-Gerät) | Validierung-first: 0 € Hardware für den Test, ob das Dashboard Last abnimmt. Tailscale (privates Mesh-VPN, kostenlos) macht „auf dem Handy unterwegs" möglich, **ohne** öffentliches Exposing → die „kein Login"-Entscheidung bleibt sicher. Pi folgt erst, wenn sich der Nutzen zeigt. |

---

## Reihenfolge (wie vom Auftraggeber empfohlen)

```
Phase 0  Tooling & Gerüst
Phase 1  Datenmodell & Persistenz          (Prisma, Seed, Repositories — getestet)
Phase 2  Verteil-Engine "Fairness-Konto"   (reine Logik, TDD)
Phase 3  Aufgaben-Domäne & Planungs-Service (Status/wiederkehrend/Projekte + Engine an DB)
Phase 4  Integration: Google Calendar       (OAuth read-only, getrennte Kalender)
Phase 5  Integration: Wetter (Open-Meteo)
Phase 6  Essensplan → Zutaten → Einkaufsliste
Phase 7  Integration: Bring!                (Spike → Entscheidung → Push/Fallback)
Phase 8  UI gegen echte Daten              (Komponenten an DB/Services, Look unverändert)
```

Jede Phase liefert für sich **lauffähige, testbare** Software. Bis Phase 8 bleibt die bestehende Mock-UI sichtbar und `npm run dev`-fähig; Fortschritt wird über Tests und Prisma Studio (`npx prisma studio`) verifiziert. *(Optional kann ein „Früh-Smoke-Wire" einzelner Kacheln vorgezogen werden, falls eine sichtbare Demo gewünscht ist — ändert die Reihenfolge nicht.)*

---

## Datei-Struktur (Zielbild)

```
web/
  prisma/
    schema.prisma                 # Datenmodell (eine Quelle der Wahrheit)
    seed.ts                       # Seed aus den bestehenden Mock-Werten (Mo, 7. Juni)
    migrations/                   # generiert
  src/
    generated/prisma/             # Prisma-Client-Output (gitignored)
    lib/
      db.ts                       # PrismaClient-Singleton (better-sqlite3-Adapter)
      domain.ts                   # geteilte Domänen-Typen/DTOs (ersetzt schrittweise data.ts)
      repositories/               # DB-Lese-/Schreibfunktionen (eine Datei je Aggregat)
        tasks.ts  accounts.ts  shopping.ts  notes.ts  meals.ts  phase.ts  projects.ts  calendar.ts
      engine/                     # REINE Logik, kein I/O
        types.ts                  # Engine-Ein-/Ausgabe-Verträge
        personFilter.ts  weatherCheck.ts  availability.ts  fairness.ts  index.ts
      services/                   # verbinden Engine + DB + externe Quellen
        planning.ts  rollover.ts  recurrence.ts  mealPlanner.ts  shoppingSync.ts
      integrations/
        weather/openMeteo.ts
        calendar/google.ts
        bring/                    # erst nach Spike
    app/
      actions/                    # Server Actions ('use server')
        tasks.ts  shopping.ts  accounts.ts  notes.ts  meals.ts  phase.ts
      api/
        auth/google/route.ts          # OAuth-Start
        auth/google/callback/route.ts # OAuth-Callback
        sync/calendar/route.ts        # manueller/periodischer Kalender-Sync
      page.tsx                    # Server Component: lädt Daten, übergibt an Dashboard
    components/                   # bestehend; Look unverändert, Datenquelle → Props
  vitest.config.ts
  .env                           # gitignored (DATABASE_URL, Google-OAuth, …)
  .env.example                   # committet (ohne Secrets)
```

**Verantwortlichkeiten (klar getrennt, einzeln testbar — Spec §7):**
- `engine/*` — entscheidet *wer/wann*, kennt **keine** DB, **kein** Netzwerk. Ein-/Ausgabe über `engine/types.ts`.
- `services/*` — orchestrieren: laden DB-Daten + Live-Quellen, rufen Engine, schreiben Ergebnis zurück.
- `repositories/*` — einzige Stelle mit Prisma-Zugriff.
- `integrations/*` — einzige Stelle mit externen HTTP-Calls.
- `app/actions/*` — dünne Server-Actions; rufen Repositories/Services, dann `revalidatePath`/`refresh`.

---

## Phase 0 — Tooling & Gerüst

**Goal:** Test- und DB-Werkzeuge stehen; Build bleibt grün. Keine Fachlogik.

**Files:**
- Modify: `web/package.json` (Scripts + DevDeps)
- Create: `web/vitest.config.ts`
- Create: `web/src/lib/__smoke__/sanity.test.ts` (Wegwerf-Smoke-Test)
- Modify/Create: `web/.gitignore` (sicherstellen: `.env*`, `*.db`, `src/generated`)
- Create: `web/.env.example`

**Schritte:**
- [ ] **0.1** Vor Next.js-bezogenem Code die relevanten Guides in `web/node_modules/next/dist/docs/` lesen (Route Handlers, Mutating Data) — pro Integrationsphase die jeweils passenden zusätzlich. *(AGENTS.md-Regel.)*
- [ ] **0.2** Vitest installieren: `npm i -D vitest` (in `web/`). DevDep erscheint in `package.json`.
- [ ] **0.3** `vitest.config.ts` anlegen (node-Environment, `@/`-Alias auf `./src` analog `tsconfig.json`).
- [ ] **0.4** Scripts ergänzen: `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] **0.5** Smoke-Test `sanity.test.ts` (`expect(1+1).toBe(2)`) anlegen, `npm test` laufen lassen → **grün**, danach Smoke-Test wieder entfernen.
- [ ] **0.6** `.gitignore` prüfen/ergänzen: `.env`, `.env.*` (außer `.env.example`), `*.db`, `*.db-journal`, `src/generated/`.
- [ ] **0.7** `.env.example` mit allen späteren Keys (leer/Platzhalter): `DATABASE_URL="file:./dev.db"`, `GOOGLE_CLIENT_ID=`, `GOOGLE_CLIENT_SECRET=`, `GOOGLE_REDIRECT_URI=`, `GOOGLE_CALENDAR_DOME=`, `GOOGLE_CALENDAR_EMELY=`, `GOOGLE_CALENDAR_FAMILY=`, `BRING_EMAIL=`, `BRING_PASSWORD=`, `BRING_LIST_UUID=`.

**Abnahme Phase 0:** `npm run build` grün **und** `npm test` läuft (0 Fehler). `git status` zeigt keine `.env`/`.db`/`generated`-Dateien als trackbar.

---

## Phase 1 — Datenmodell & Persistenz

**Goal:** Prisma-Schema bildet das konzeptionelle Datenmodell (Spec §6) ab; DB wird per Seed mit den bestehenden Mock-Werten (Mo, 7. Juni) gefüllt; Repositories liefern/ändern Daten und sind getestet.

**Files:**
- Create: `web/prisma/schema.prisma`, `web/prisma/seed.ts`
- Create: `web/src/lib/db.ts`, `web/src/lib/domain.ts`
- Create: `web/src/lib/repositories/{tasks,accounts,shopping,notes,meals,phase,projects,calendar}.ts`
- Create: Tests `web/src/lib/repositories/*.test.ts`
- Modify: `web/package.json` (Prisma-Deps + `prisma.seed`-Konfig)

**Doku zuerst:** Prisma SQLite-Setup per `ctx7`/`find-docs` bestätigen (Generator `prisma-client`, `@prisma/adapter-better-sqlite3`, `migrate dev`, `db seed`).

**Schritte:**
- [ ] **1.1** Prisma installieren: `npm i -D prisma` + `npm i @prisma/client @prisma/adapter-better-sqlite3 better-sqlite3`. `npx prisma init --datasource-provider sqlite` (legt `prisma/schema.prisma` + `.env` mit `DATABASE_URL`).
- [ ] **1.2** `schema.prisma` schreiben — Generator `prisma-client` (Output `../src/generated/prisma`), Datasource `sqlite`, **Modelle** (Felder als Design-Vertrag, Spec §6):
  - `Person` { id, key @unique (`"dome"|"emely"|"baby"`), name, colorAccent, role (`"adult"|"baby"`) }
  - `Task` { id, title, type (`"routine"|"todo"|"shopping"|"project"`), effort Int, rhythm String? (z.B. `"weekly"`, `"2x-week"`), allowedPersons (`"both"|"dome"|"emely"`), outdoor Bool @default(false), weatherCondition String? (JSON `{noRain:bool, minTemp?:number}`), status (`"open"|"done"|"moved"|"failed"`) @default("open"), reason String?, icon String?, note String?, sub String?, assignedToId FK Person?, projectId FK Project?, recurringParentId String?, dueDate DateTime, completedAt DateTime?, createdAt @default(now) }
  - `Project` { id, title, icon?, tasks Task[] }
  - `CalendarEvent` { id, externalId @unique, calendarKey, title, start DateTime, end DateTime, personKey String?, kind (`"termin"|"baby-arzt"`) @default("termin"), place String?, updatedAt } *(Spiegel von Google; in Phase 1 geseedet)*
  - `AccountEntry` { id, personId FK Person, label, points Int, source (`"planned"|"nachtrag"|"betreuung"`), taskId String?, occurredAt DateTime @default(now) }
  - `PhaseSetting` { id, mode (`"normal"|"elternzeit"`), targetDome Int, targetEmely Int, caregiverKey String?, activeFrom DateTime, activeUntil DateTime?, isActive Bool @default(true) }
  - `Recipe` { id, name, simple Bool @default(true), tags String? (JSON, Stufe 2), ingredients Ingredient[] }
  - `Ingredient` { id, recipeId FK Recipe, name, amount String?, unit String? }
  - `MealPlanEntry` { id, date DateTime (Tag), recipeId FK Recipe }
  - `ShoppingItem` { id, text, meal Bool @default(false), source (`"manual"|"recipe"`) @default("manual"), recipeRef String?, done Bool @default(false), createdAt @default(now) }
  - `Note` { id, icon?, text, pinned Bool @default(false), date DateTime? }
  - *(Stufe 2, später: `Preference` { id, personId, kind (`"like"|"dislike"`), value })*
- [ ] **1.3** `npx prisma migrate dev --name init` → Migration + Client-Generierung. **Abnahme:** `dev.db` entsteht, `src/generated/prisma` existiert.
- [ ] **1.4** `db.ts` — PrismaClient-Singleton mit `@prisma/adapter-better-sqlite3` (verhindert Mehrfach-Instanzen im Dev-HMR; `globalThis`-Cache).
- [ ] **1.5** `domain.ts` — geteilte TS-Typen/DTOs für die UI (Mapping von Prisma-Modellen auf die in Phase 8 von Komponenten erwarteten Formen; baut auf den vorhandenen `data.ts`-Interfaces auf: `Task`, `Appointment`, `ShoppingItem`, `Meal`, `Note`, `PersonStyle`, `PersonKey`, `TaskStatus`).
- [ ] **1.6** `seed.ts` — füllt DB **identisch** zur aktuellen `data.ts`-Demo: Personen (dome/emely/baby + `PERSON`-Farben), Tasks t1–t5, 3 `CalendarEvent` (11:00 U4/baby-arzt, 18:30 Sport/dome, 20:00 Paket), ShoppingItems s1–s8, MealPlan Mo–Fr, Notes n1–n3, `PhaseSetting` Elternzeit (target **Dome 60 / Emely 40**, caregiver=emely, aktiv), `AccountEntry`s so dotiert, dass die **berechnete** Wochen-Aufteilung ≈ **Dome 60 / Emely 40** ergibt (ersetzt den bisherigen Mock-Wert 72/28), ein `Project` „Babyzimmer einrichten" (4/6). `package.json` → `"prisma": { "seed": "tsx prisma/seed.ts" }` (+ `npm i -D tsx`). `npx prisma db seed`.
- [ ] **1.7** Repository `tasks.ts` — Funktionen + Tests: `getTasksForDay(date)`, `getTasksByPerson(personKey, date)`, `getOpenTaskCount()`, `getProjectProgress(projectId)`. Tests gegen eine **temporäre Test-DB** (`DATABASE_URL=file:./test.db`, vor jedem Lauf migriert+geseedet oder programmatisch befüllt).
- [ ] **1.8** Repositories `accounts.ts` (`getWeeklyBalances()`, `getComputedSplit()`), `phase.ts` (`getActivePhase()`), `shopping.ts`, `notes.ts`, `meals.ts`, `projects.ts`, `calendar.ts` (`getTodaysEvents()`) — jeweils mit kleinen Tests für die Lesepfade.
- [ ] **1.9** `npm run build` + `npm test` → grün.

**Abnahme Phase 1:** `npx prisma studio` zeigt alle geseedeten Datensätze; `getComputedSplit()` liefert ≈ {dome:60, emely:40}; alle Repository-Tests grün; Build grün.

---

## Phase 2 — Verteil-Engine „Fairness-Konto" (reine Logik, TDD)

**Goal:** Die Entscheidungs-Pipeline aus Spec §5.2 als **reines, getestetes** Modul ohne jegliches I/O. Herzstück des Mental-Load-Ziels.

**Files:**
- Create: `web/src/lib/engine/types.ts`
- Create: `web/src/lib/engine/{personFilter,weatherCheck,availability,fairness,index}.ts`
- Create: `web/src/lib/engine/*.test.ts`

**Design-Vertrag (`engine/types.ts`):**
```ts
type PersonKey = "dome" | "emely";
interface EngineTask {
  id: string;
  allowedPersons: "both" | "dome" | "emely";
  outdoor: boolean;
  weatherCondition?: { noRain: boolean; minTemp?: number };
  effort: number;
}
interface BusyWindow { person: PersonKey; start: Date; end: Date; }
interface DayForecast { date: string; rainWindows: { from: string; to: string }[]; minTemp: number; maxTemp: number; }
interface PhaseConfig { mode: "normal" | "elternzeit"; target: Record<PersonKey, number>; caregiver?: PersonKey; }
type Balances = Record<PersonKey, number>;
interface PlanInput {
  task: EngineTask;
  day: Date;                       // geplanter Tag
  window?: { start: Date; end: Date }; // Zeitfenster der Aufgabe (für Verfügbarkeit/Wetter)
  persons: PersonKey[];
  busy: BusyWindow[];
  forecast: DayForecast[];         // Vorhersage für day + Folgetage (für Verschiebe-Vorschlag)
  phase: PhaseConfig;
  balances: Balances;
}
type PlanResult =
  | { kind: "assigned"; person: PersonKey; day: Date }
  | { kind: "deferred"; reason: string; suggestedDay: Date }
  | { kind: "unassignable"; reason: string };
```

**Schritte (jeweils TDD: Test rot → minimal grün → commit):**
- [ ] **2.1** `personFilter(task, persons) → PersonKey[]` — Spec §5.2/1. Tests: `both`→beide; `dome`→nur dome; `emely`→nur emely.
- [ ] **2.2** `checkWeather(task, day, forecast) → { ok: true } | { ok: false; suggestedDay: Date; reason: string }` — Spec §5.2/2 & §9. Tests: Nicht-Outdoor→immer ok; Outdoor+kein Regen→ok; Outdoor+Regen im Fenster→nicht ok, schlägt nächsten regenfreien Tag vor; optionale `minTemp` unterschritten→nicht ok.
- [ ] **2.3** `filterByAvailability(persons, day, window, busy) → PersonKey[]` — Spec §5.2/3. **Beide Personen gelten als verfügbar, solange kein Kalender-Termin im Fenster liegt — auch Emely** (Auftraggeber-Entscheidung, weicht bewusst von Spec §9 ab). Die geringere Last für Emely steuert **allein** das Fairness-Ziel (60/40, Schritt 2.4), **kein** Verfügbarkeits-Ausschluss. Tests: belegtes Fenster fällt raus; ohne Termin ist die Person Kandidatin (Emely eingeschlossen).
- [ ] **2.4** `computeShare(balances) → Record<PersonKey, number>` (Ist-Anteil) und `selectByFairness(persons, balances, target) → PersonKey` — Spec §5.2/4. Tests: bei gleichem Konto entscheidet Ziel-Abweichung; wer am **weitesten hinter** seinem Ziel-Anteil liegt, bekommt die Aufgabe; 50/50- und 60/40-Ziel getestet.
- [ ] **2.5** `planTask(input) → PlanResult` (`index.ts`) — verkettet 2.1→2.4 in genau der Pipeline-Reihenfolge. Tests für die Spec-Beispiele:
  - „Rasen mähen = nur Dome, Outdoor, Regen ab 16:00" → `deferred` auf nächsten regenfreien Tag (= Mock „Regen → Mi").
  - Indoor-Aufgabe, beide erlaubt, Elternzeit-Ziel 60/40, Dome hinter Ziel → `assigned` an Dome.
  - Indoor-Aufgabe, beide erlaubt, Emely hinter ihrem 40%-Ziel → `assigned` an Emely (sie ist verfügbar und Kandidatin).
  - Niemand verfügbar (beide haben Termin) → `unassignable` mit Grund.
  - Nur-Emely-Aufgabe → `assigned` an Emely (Personen-Filter).
- [ ] **2.6** `recordCompletion`-Hilfsfunktion (rein): aus erledigter Aufgabe eine `AccountEntry`-Eingabe (person, points, source) ableiten — Spec §5.2 (Punkte nur fürs Erledigen). Test: offene/verschobene Aufgabe erzeugt **keine** Buchung; erledigte erzeugt Buchung mit `effort`.

**Abnahme Phase 2:** `npm test` zeigt alle Engine-Tests grün; die Engine importiert **nichts** aus `lib/db`, `lib/repositories`, `integrations` oder `next` (per Grep verifizieren); `npm run build` grün.

---

## Phase 3 — Aufgaben-Domäne & Planungs-Service

**Goal:** Status-Übergänge, automatisches Weiterrollen, wiederkehrende Aufgaben und Projekte als getestete Services; der Planungs-Service verdrahtet die Engine mit DB-Daten und schreibt Zuweisungen/Buchungen zurück. „Erledigt nachtragen" (Spontan-Nachtrag) inklusive.

**Files:**
- Create: `web/src/lib/services/{rollover,recurrence,planning}.ts` + Tests
- Create/Modify: `web/src/lib/repositories/{tasks,accounts}.ts` (Schreibfunktionen)
- Create: `web/src/app/actions/{tasks,accounts}.ts` (Server Actions; UI-Verdrahtung erst Phase 8, aber Actions hier testbar definierbar)

**Schritte:**
- [ ] **3.1** Repository-Schreibfunktionen + Tests: `setTaskStatus(id, status, reason?)` (bei `done` → `completedAt` setzen **und** `AccountEntry` via `recordCompletion` buchen; Toggle `done`→`open` macht Buchung rückgängig), `assignTask(id, personKey, day)`.
- [ ] **3.2** `accounts.ts`: `addManualEntry({personKey, label, points, source})` für **Spontan-Nachtrag** (Spec §5.3) inkl. Betreuungs-Quelle (`betreuung`). Test: Buchung erscheint im Wochen-Saldo; `getComputedSplit()` verschiebt sich.
- [ ] **3.3** `recurrence.ts`: `nextDueDate(task, from)` für Rhythmen (`weekly`, `2x-week`, …) + `materializeDueInstances(date)` (erzeugt fällige Instanzen wiederkehrender Routinen). TDD mit festen Daten.
- [ ] **3.4** `rollover.ts`: `rolloverOpenTasks(fromDay, toDay)` — `open`/`moved` Aufgaben wandern auf den Folgetag (Spec §5.1: „rollen automatisch weiter, kein manuelles Nachhalten"); `done`/`failed` bleiben. Test: Status-Matrix.
- [ ] **3.5** `planning.ts`: `planDueTasks(day)` — lädt fällige Tasks, aktive Phase, Konten (DB), Verfügbarkeit (in Phase 3 noch **leere** busy-Liste/Stub) und Wetter (Stub) , ruft `planTask` je Aufgabe, schreibt `assigned`/`deferred`/`unassignable` zurück (Status `moved` + `note` bei deferred). Test mit gestubbten Quellen → deterministische Zuweisungen in DB.
- [ ] **3.6** Server Actions `actions/tasks.ts` (`toggleTaskAction`, `deferTaskAction`, `failTaskAction(reason)`) und `actions/accounts.ts` (`addManualEntryAction`) als dünne `'use server'`-Wrapper um die Repos + `revalidatePath('/')`. *(Verdrahtung an UI in Phase 8.)*

**Abnahme Phase 3:** Alle Service-/Repo-Tests grün; nach `planDueTasks(seedDay)` zeigt die Test-DB konsistente Zuweisungen; Build grün.

---

## Phase 4 — Integration: Google Calendar (read-only, OAuth, getrennte Kalender)

**Goal:** Echte Termine aus den getrennten Kalendern (Dome/Emely/Familie) spiegeln; Personen-Zuordnung aus dem Quell-Kalender; Verfügbarkeits-Fenster für die Engine.

**Files:**
- Create: `web/src/integrations/calendar/google.ts`
- Create: `web/src/app/api/auth/google/route.ts`, `web/src/app/api/auth/google/callback/route.ts`
- Create: `web/src/app/api/sync/calendar/route.ts`
- Modify: `web/src/lib/repositories/calendar.ts` (Upsert aus Google), `web/src/lib/services/planning.ts` (echte `busy`-Windows)
- Create: Tests `web/src/integrations/calendar/*.test.ts` (gegen gemockte Google-Antworten/Fixtures)

**Doku & Machbarkeit zuerst:**
- [ ] **4.1** `googleapis` + OAuth-2.0-Flow per `ctx7`/`find-docs` klären (read-only Scope `calendar.readonly`, Refresh-Token serverseitig, `events.list` + `freebusy.query`). `npm i googleapis`.
- [ ] **4.2** Google-Cloud-Projekt/OAuth-Client durch den Auftraggeber anlegen lassen (Anleitung im Plan dokumentieren); Calendar-IDs der drei Kalender ermitteln (per `calendarList.list`) → in `.env` (`GOOGLE_CALENDAR_DOME/EMELY/FAMILY`). **Abnahme-Gate:** echte IDs vorhanden.

**Schritte:**
- [ ] **4.3** OAuth-Route-Handler: `/api/auth/google` (Consent-Redirect) + `/api/auth/google/callback` (Code→Tokens, Refresh-Token sicher speichern: `.env` oder DB-Tabelle `OAuthToken`). Manuell verifizieren: Verbindung herstellbar.
- [ ] **4.4** `google.ts`: `fetchEvents(calendarKey, from, to)` (mappt Google-Event→`CalendarEvent`-DTO inkl. `personKey` aus `calendarKey`, `kind` aus Stichwort-Heuristik „U4/Kinderarzt/Hebamme"→`baby-arzt`) und `fetchBusyWindows(persons, from, to)` (via freebusy). Tests gegen Fixtures (kein echter Call im Test).
- [ ] **4.5** `repositories/calendar.ts`: `upsertEvents(events)` (Spiegelung idempotent über `externalId`).
- [ ] **4.6** Sync-Route `/api/sync/calendar`: holt heute+kommende Tage, upsertet. Manuell aufrufen → `CalendarEvent`-Tabelle gefüllt.
- [ ] **4.7** `planning.ts` nutzt jetzt **echte** `fetchBusyWindows` statt Stub (Elternzeit-Sonderregel aus 2.3 greift weiterhin).

**Abnahme Phase 4:** Nach Sync zeigt `getTodaysEvents()` echte Termine mit korrekter Personen-Zuordnung; `planDueTasks` berücksichtigt echte Belegung; Integrationstests (Fixtures) grün; Secrets nur in `.env`. Build grün.

---

## Phase 5 — Integration: Wetter (Open-Meteo)

**Goal:** Aktuelles Wetter + Tagesvorhersage live; speist Wetter-Kachel **und** den Wetter-Check der Engine.

**Files:**
- Create: `web/src/integrations/weather/openMeteo.ts` + Tests (Fixtures)
- Modify: `web/src/lib/services/planning.ts` (echte `forecast` statt Stub)

**Schritte:**
- [ ] **5.1** Open-Meteo-Endpunkt/Parameter per `ctx7`/`find-docs` klären (stündlich `precipitation`, `temperature_2m`; Koordinaten des Haushalts in `.env` oder Konstante). Kein API-Key nötig.
- [ ] **5.2** `openMeteo.ts`: `getForecast(days) → DayForecast[]` (mappt Open-Meteo-Antwort auf den **Engine-Vertrag** aus 2: `rainWindows`, `minTemp`, `maxTemp`) und `getCurrent() → { temp, label, hi, lo, detail, rainFrom? }` (für die Kachel im bestehenden `weather`-Format). Tests gegen Fixture: Regen-Stunden→`rainWindows`; Mapping korrekt.
- [ ] **5.3** Live-Fetch mit Next-Caching (Revalidierung ~30 min) im späteren Server-Component-Pfad; Fallback bei Fehler (letzter/Platzhalter-Wert, kein Crash).
- [ ] **5.4** `planning.ts` nutzt echten `getForecast` → der Verschiebe-Vorschlag der Engine basiert auf realer Vorhersage.

**Abnahme Phase 5:** `getCurrent()`/`getForecast()` liefern echte Werte (manuell geprüft); Engine verschiebt eine Outdoor-Aufgabe nur bei realem Regen; Wetter-Tests grün; Build grün.

---

## Phase 6 — Essensplan → Zutaten → Einkaufsliste

**Goal:** Automatischer Wochen-Essensplan aus kuratiertem Rezeptbuch (Stufe 1); Zutaten werden extrahiert und landen auf der Einkaufsliste (markiert als Rezept-Zutat 🍽️). Phasen-bewusst: einfache/schnelle Gerichte bevorzugt.

**Files:**
- Create: `web/src/lib/services/{mealPlanner,shoppingSync}.ts` + Tests
- Modify: `web/prisma/seed.ts` (Rezeptbuch mit Zutaten seeden)
- Create: `web/src/app/actions/meals.ts` (Plan generieren)

**Schritte:**
- [ ] **6.1** Rezeptbuch seeden: die 5 Demo-Gerichte (Pasta al Pomodoro, Gemüse-Curry, Reste, Ofengemüse, Pizzaabend) als `Recipe` mit `Ingredient`-Listen; `simple=true` für schnelle Gerichte. Demo-Einkaufszutaten (Tomaten/Basilikum/Parmesan) den passenden Rezepten zuordnen.
- [ ] **6.2** `mealPlanner.ts`: `generateWeekPlan(weekStart, { preferSimple }) → MealPlanEntry[]` (Stufe 1: Auswahl aus Rezeptbuch; im Elternzeit-Modus `preferSimple=true`). TDD: deterministische Auswahl bei festem Seed; bevorzugt `simple`-Rezepte.
- [ ] **6.3** `shoppingSync.ts`: `syncIngredientsToShopping(weekPlan)` — extrahiert Zutaten aller Plan-Rezepte, dedupliziert/aggregiert, legt `ShoppingItem`s mit `meal=true, source="recipe"` an (vorhandene manuelle Artikel bleiben unberührt). TDD: Aggregation gleicher Zutat; manuelle Artikel bleiben.
- [ ] **6.4** Server Action `actions/meals.ts`: `generatePlanAction(weekStart)` → `generateWeekPlan` + `syncIngredientsToShopping` + `revalidatePath('/')`.

**Abnahme Phase 6:** `generatePlanAction` erzeugt einen Wochenplan **und** passende 🍽️-Einkaufsartikel; Tests für Planung + Zutaten-Sync grün; Build grün.

---

## Phase 7 — Integration: Bring! (Spike zuerst — Entscheidungs-Gate)

**Goal:** Erst Machbarkeit der inoffiziellen Bring!-Schnittstelle klären (Spec §8), **dann** entscheiden: Push umsetzen **oder** dokumentierten Fallback.

**Files (abhängig vom Spike):**
- Create: `docs/spikes/2026-06-07-bring-machbarkeit.md` (Ergebnis-Dokumentation)
- Create (falls machbar): `web/src/integrations/bring/client.ts` + Tests; Modify `shoppingSync.ts` (Push-Hook); ggf. Action/Route
- Create (falls Fallback): Fallback-Mechanismus (z.B. Bring!-Import-Link / „Liste teilen")

**Schritte:**
- [ ] **7.1** **Spike (zeitlich begrenzt):** inoffizielle Bring!-REST-Schnittstelle prüfen (Login-Flow, Listen-UUID, „add item"-Call). Aktuelle Lage per `find-docs`/Web recherchieren (z.B. verbreitete `bring`/`bring-shopping`-Clients). Mit **eigenen Test-Credentials** in `.env` (nie committen) einen einzelnen Test-Artikel pushen.
- [ ] **7.2** **Entscheidungs-Gate dokumentieren** in `docs/spikes/...md`: Funktioniert Auth + Add zuverlässig? Risiko/Stabilität? → Empfehlung **Push** oder **Fallback**. *(Auftraggeber-Freigabe einholen, welcher Weg.)*
- [ ] **7.3a** *(falls machbar)* `bring/client.ts`: `login()`, `addItems(listUuid, items)`; `shoppingSync` pusht neue `ShoppingItem`s (Richtung **Dashboard→Bring**, Spec §5.6). Tests gegen gemockte HTTP; ein manueller Live-Smoke-Push.
- [ ] **7.3b** *(falls nicht/instabil)* Fallback umsetzen (z.B. teilbarer Bring!-Import-Link aus der Liste) + klar im UI kennzeichnen.

**Abnahme Phase 7:** `docs/spikes/...md` enthält belastbares Ergebnis + Entscheidung; gewählter Weg implementiert und (Push: Live-Smoke / Fallback: manuell) verifiziert; Credentials nur in `.env`. Build grün.

---

## Phase 8 — UI gegen echte Daten (Look unverändert)

**Goal:** Bestehende Komponenten lesen aus der DB (Server Components) und schreiben über Server Actions — **ohne** den visuellen Look, Tokens oder das Layout zu verändern (Spec §2; Design-Prompt „Nicht tun").

**Files:**
- Modify: `web/src/app/page.tsx` (Server Component: lädt via Repositories, übergibt Props)
- Modify: `web/src/components/dashboard.tsx` (Client-Shell: erhält Initialdaten als Props, ruft Server Actions; behält Dark-Mode + optimistische Toggles)
- Modify: `web/src/components/tiles.tsx`, `widgets.tsx` (statt Direkt-Import aus `data.ts` → Props/Action-Aufrufe)
- Modify/Reduce: `web/src/lib/data.ts` (nur noch Typen/Styles; Mock-Werte entfallen oder wandern in `seed.ts`)

**Schritte (eine Kachel nach der anderen, Look jeweils per Vorher/Nachher prüfen):**
- [ ] **8.1** `page.tsx` → Server Component, lädt alle Sektionsdaten über Repositories/Services und reicht sie an `Dashboard` (Client) als `initial*`-Props.
- [ ] **8.2** `dashboard.tsx`: Initialdaten aus Props statt `initialTasks`/`initialShopping`; `toggleTask`/`toggleShop` rufen Server Actions (`toggleTaskAction`, `toggleShoppingAction`) mit optimistischem Update + `useTransition`; `refresh()`/`revalidatePath` für Konsistenz.
- [ ] **8.3** Wetter-Kachel (`WeatherTile`) erhält Live-Wetter aus 5 als Props (Format `weather` unverändert).
- [ ] **8.4** Aufgaben-Kacheln nutzen DB-Tasks; Termin-Kachel nutzt `getTodaysEvents()` (Phase 4); `PersonBadge`-Look unverändert.
- [ ] **8.5** Fairness-/Elternzeit-Streifen (`ElternzeitStripe`) nutzt `getComputedSplit()` + aktive Phase statt konstantem `split`; Text/Optik unverändert; ergänzt dezenten Hinweis „nächste Aufgabe geht an …" aus der Engine (Spec §4/§5.2) im **bestehenden** Stil.
- [ ] **8.6** Widgets (Einkauf/Essensplan/Notizen/Wochenübersicht) lesen aus DB; Einkauf-Toggle + Notiz-Anlegen über Actions; „synct mit Bring!"-Badge gemäß Phase-7-Ergebnis (echt vs. Hinweis).
- [ ] **8.7** Interaktive Ergänzungen im **bestehenden** Look: „Erledigt nachtragen"-Aktion (3.2/3.6), Phasen-Modus-Umschalter (Normal/Elternzeit, Spec §5.2a). Keine neue Settings-Seite, nur dezente Steuerung.
- [ ] **8.8** `data.ts` auf Typen/`PERSON`-Styles reduzieren; tote Mock-Exporte entfernen; sicherstellen, dass keine Komponente mehr Mock-Werte importiert (Grep).

**Abnahme Phase 8:** Dashboard rendert dieselben Inhalte wie die Demo, jetzt aus der DB; Abhaken/Nachtragen/Plan-Generieren persistiert über Reload; visueller Vergleich (Screenshot Vorher/Nachher) zeigt **keinen** Look-Unterschied; `npm run build` grün; alle Tests grün.

---

## Phase 9 — Deployment & Betrieb (früh nutzbar, dann Always-on)

**Goal:** Dashboard real auf dem **Pixel Tablet** + **Handys (auch unterwegs)** nutzbar machen — zuerst für den Praxistest (prüfen, ob es Last *abnimmt* statt erzeugt), dann dauerhaft auf dem Raspberry Pi.

### Stufe 9a — Praxistest (sofort möglich, 0 € Hardware)
- [ ] **9a.1** App als **PWA** installierbar machen: `manifest.webmanifest` + Icons + Metadaten (Next.js App Router `metadata`/`manifest`), damit sie auf Tablet & Handy app-artig auf den Startbildschirm kommt. *(Kleine UI-Ergänzung, Look unverändert.)*
- [ ] **9a.2** Production-Lauf auf dem **bestehenden Windows-11-PC**: `npm run build` + `npm start`; im Heim-WLAN von Tablet/Handys erreichbar.
- [ ] **9a.3** **Tailscale** (kostenlos) auf PC + beiden Handys + Pixel Tablet installieren; Zugriff über MagicDNS-Name. Kein Portfreigeben, kein öffentliches Exposing → „kein Login" bleibt sicher. *(Alternative: Cloudflare Tunnel für eine öffentliche HTTPS-URL — dann aber Zugriffsschutz nötig; daher nicht Default.)*
- [ ] **9a.4** Pixel Tablet (Mehrzweck-Gerät): **kein gesperrter Kiosk**, sondern PWA auf Startbildschirm / Hub-Modus, Chrome-Vollbild; Display-Timeout/Helligkeit nach Wunsch.
- [ ] **9a.5** **Praxistest starten** (1–2 Wochen): Reduziert es den Mental Load oder macht es mehr Arbeit? Beobachtungen sammeln → entscheidet über Pi-Kauf & Feature-Ausbau.

**Abnahme 9a:** Tablet **und** beide Handys (Handy auch mobil/LTE via Tailscale) öffnen das Dashboard; Daten persistieren geräteübergreifend; Test läuft.

### Stufe 9b — Always-on auf Raspberry Pi (nach positivem Test / Pi-Kauf)
- [ ] **9b.1** Pi 5 (4 GB) mit Raspberry Pi OS Lite (64-bit) + Node LTS aufsetzen; Repo + SQLite-Datei; Prozess-Manager (pm2 **oder** systemd) für **Autostart/Neustart nach Stromausfall**.
- [ ] **9b.2** Tailscale auf dem Pi; SQLite-`.db` vom PC übernehmen (oder neu seeden). **Backup:** Cron-Kopie der `.db` (z. B. täglich).
- [ ] **9b.3** Tablet/Handys auf die Pi-URL umstellen (lokal + via Tailscale).

**Abnahme 9b:** Pi startet nach Reboot automatisch; Tablet/Handys erreichen es lokal und unterwegs; tägliches DB-Backup vorhanden.

---

## Querschnitt / Regeln (für alle Phasen)

- **Verifizieren** (Skill `verification-before-completion`): jede Phase endet mit `npm run build` **grün** und `npm test` **grün**; Behauptungen nur mit Beleg (Befehlsausgabe/Screenshot).
- **Secrets**: ausschließlich in `.env*` (gitignored), nie committen; `.env.example` gepflegt.
- **Branching**: Feature-Arbeit von `main` abzweigen; **nicht ungefragt** committen/pushen.
- **Doku vor Code**: pro Integration zuerst `ctx7`/`find-docs`; Next.js-Themen zusätzlich `node_modules/next/dist/docs/` (AGENTS.md).
- **Design**: Tokens (`globals.css`) und Komponenten wiederverwenden; Look nicht verändern (Design-Prompt).
- **Engine-Reinheit**: `engine/*` bleibt frei von DB/Netzwerk/Next-Imports (per Grep prüfbar) — Voraussetzung für die TDD-Tests.

---

## Self-Review (Spec-Abdeckung)

| Spec-Anforderung | Abgedeckt durch |
|---|---|
| §5.1 Vier Aufgabentypen, Status, Eigenschaften | Phase 1 (`Task`-Modell), Phase 3 (Status/Recurrence/Rollover) |
| §5.2 Verteil-Pipeline (Filter→Wetter→Verfügbarkeit→Fairness) | Phase 2 (Engine), Phase 3/4/5 (echte Eingaben) |
| §5.2a Elternzeit-/Phasen-Modus | Phase 1 (`PhaseSetting`, Ziel 60/40), Phase 2 (2.4 Fairness-Ziel), Phase 8 (Umschalter) |
| §5.3 Spontan-Nachtrag (inkl. Betreuung) | Phase 3 (3.2/3.6), Phase 8 (8.7 UI) |
| §5.4 Google Calendar (read-only, OAuth, Verfügbarkeit, Baby-Arzt) | Phase 4 |
| §5.5 Essensplan (Stufe 1, phasen-bewusst) | Phase 6 (Stufe 2 als spätere Ausbaustufe markiert) |
| §5.6 Einkauf + Bring!-Push | Phase 6 (Zutaten→Liste), Phase 7 (Bring-Spike→Push/Fallback) |
| §5.7 Wetter (Anzeige + Engine-Eingabe) | Phase 5 |
| §5.8 Notizen & Wochenübersicht | Phase 1 (`Note`/`Project`), Phase 8 (Widgets) |
| §6 Datenmodell | Phase 1 (Prisma-Schema) |
| §7 Architektur/Schnittstellen, einzeln testbar | Datei-Struktur + Engine/Service/Repo-Trennung |
| §8 Risiken (Bring/Kalender-Zuordnung/Wetter-Wahl) | Phase 7 (Spike), Phase 4 (getrennte Kalender), Phase 5 (Open-Meteo) |
| §9 Annahmen (Verfügbarkeit, Outdoor-Bedingung) | Phase 2 (2.2/2.3) — **Abweichung lt. Auftraggeber:** Emely zählt als verfügbar; Laststeuerung über Ziel 60/40 statt Auto-Ausschluss |

**Spätere Ausbaustufen (Spec §10, nicht Teil dieses Plans):** Essensplan Stufe 2 (präferenz-lernend, `Preference`-Modell), Vorratsverwaltung, mehr Personen, Zwei-Wege-Bring-Sync.
