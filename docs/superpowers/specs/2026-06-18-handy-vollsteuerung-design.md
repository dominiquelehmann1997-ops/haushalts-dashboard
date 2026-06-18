# Handy-Vollsteuerung (Mobile Control v2)

> **Status:** Design freigegeben (2026-06-18).
> Nächster Schritt: `writing-plans` → Implementierungs-Plan.
> Ersetzt/erweitert die ursprüngliche [Handy-Steuerung-Spec](2026-06-17-handy-steuerung-design.md).

## Ziel

Das Handy soll das **gesamte Dashboard steuern**, damit am Tablet (Glanceable-Anzeige) nur noch wenige kleine Aktionen nötig sind. Dazu zwei Dinge in einer Iteration:

1. **Re-Skin** der bestehenden `/mobile`-Oberfläche auf das **allgemeine Designkonzept** des Tablets (warmes Cream, Ink-Text, Personen-Farben Dome=Teal / Emely=Koralle, weiche Karten `rounded-xl2`, weiche Schatten). Aktuell nutzt das Mobile-Layout ein fremdes `bg-slate-950`-Dark-Theme.
2. **Steuerumfang ausweiten** auf alles, was das Dashboard kann — inklusive neuer Backend-Stücke (Aufgabe erfassen, persistente Notizen, Recurrence/Intervall-Neustart, adaptives Lern-Intervall).

## Entscheidungen (Brainstorming 2026-06-18)

- **Theme:** Cream-Light als Default + automatische Dark-Variante via `prefers-color-scheme` (Karten tragen bereits `dark:`-Klassen).
- **Navigation:** 5-Tab-Bottom-Nav — Heute · Aufgaben · Essen · Einkauf · Mehr.
- **Backend-Umfang:** voller Umfang — vorhandene Actions verdrahten **+** Aufgabe erfassen **+** persistente Notizen.
- **Lernmechanik (Feature B):** voller Umfang — Recurrence verdrahten + Intervall ab Erledigungsdatum neu starten + `learnedInterval`-EWMA bauen und im Generator nutzen.

## Designkonzept (Quelle)

Tokens/Muster aus dem Tablet, wiederverwenden statt neu erfinden:

- Tokens in [`web/src/app/globals.css`](../../../web/src/app/globals.css): `cream` (#f7f3ec), `ink`/`ink-soft`/`ink-faint`, `dome`/`emely` (+ deep/soft/tint), `shadow-card`/`shadow-lift`, `radius-xl2` (1.75rem), `rise`-Animation.
- Komponenten in [`web/src/components/ui.tsx`](../../../web/src/components/ui.tsx): `<Card>`, `<CardHead>` (Eyebrow + `font-display`-Titel + Akzent-Dot), `<PersonBadge>`.
- Personen-Stile aus `PERSON` in [`web/src/lib/data.ts`](../../../web/src/lib/data.ts).

## Architektur & Routing

Bestehende Trennung bleibt: Tablet auf `/`, Handy unter `app/(mobile)/` mit eigenem Layout. Handy als PWA mit Start-URL `/mobile` installierbar.

### Routen

| Tab | Route | Zweck |
|-----|-------|-------|
| **Heute** | `/mobile` (statt Redirect → echte Seite) | Landing: Wetter, heutige Aufgaben pro Person (abhakbar), Termine, Elternzeit-Balken |
| **Aufgaben** | `/mobile/tasks` | Offene Liste + Quick-Add + „Erledigt nachtragen"-Picker + Aufschieben |
| **Essen** | `/mobile/meals` | bestehend (`MealDraftPanel`), re-skinned |
| **Einkauf** | `/mobile/shopping` (neu) | Liste abhaken, Frische, „An Bring! senden" |
| **Mehr** | `/mobile/more` (neu) | Notizen-CRUD, Elternzeit-Modus, Setup/Push, System-Status |

`(mobile)/mobile/page.tsx` wird vom Redirect zur echten Heute-Seite. Alte `notes`/`settings`-Inhalte wandern unter Heute/Mehr.

## Design-Shell (Re-Skin)

- **Layout** [`web/src/app/(mobile)/layout.tsx`](../../../web/src/app/(mobile)/layout.tsx): `bg-cream text-ink` + `dark:bg-[#1b1a18] dark:text-cream`, `font-body`, `pb-safe`. Scroll-Container bleibt.
- **Karten:** durchgängig `<Card>` statt Slate-Boxen.
- **Seitenkopf:** neuer Mobile-`PageHeader` im `CardHead`-Stil (Eyebrow uppercase `text-ink-faint`, `font-display`-Titel, optional Personen-Dot).
- **Bottom-Nav:** Cream/weiße Bar, aktiver Tab in Akzentfarbe (statt weiß-auf-slate), 5 Einträge mit `lucide`-Icons (`Sun`/`Home`, `CheckSquare`, `Utensils`, `ShoppingCart`, `Menu`).
- **Dark:** automatisch über `prefers-color-scheme`.
- **Animation:** `rise` auf Seiteninhalt.

## Komponenten

Neue Mobile-Komponenten unter `web/src/components/mobile/`. Bestehende Tablet-Komponenten werden wiederverwendet:

- **Wiederverwendet:** `TaskTile`, `AppointmentsTile`, `MealDraftPanel`, `Weather`, `FreshShoppingControl`, `BringSyncControl`, `PhaseSwitch`, `PushSetupControl`, `Card`, `CardHead`, `PersonBadge`.
- **Neu:** `PageHeader`, re-skinned `MobileNavBar` (5 Tabs), `TodayView`, `TasksView` (Client), `ShoppingView`, `MoreView`, `NotesEditor`/`NotesList`.

### Heute (`TodayView`, Server-Component)
Komponiert Wetter, heutige `TaskTile` pro Person (abhaken/defer/fail), `AppointmentsTile`, Elternzeit-Balken (`split` + `PhaseSwitch`). Vertikal gestapelt in `<Card>`s — spiegelt das Tablet-Hero-Band.

### Aufgaben (`TasksView`, Client-Component)
- **Offene Liste:** abhaken (`toggleTaskAction`), aufschieben (`deferTaskAction` — existiert), nicht geschafft (`failTaskAction`). `useOptimistic` wie [`dashboard.tsx`](../../../web/src/components/dashboard.tsx).
- **Quick-Add (neu):** „+" → kompaktes Formular (Titel, Typ, Person/`allowedPersons`, Aufwand, optional Rhythmus + Fälligkeit) → `addTaskAction`.
- **„Erledigt nachtragen"-Picker (neu):** Auswahl aus allen offenen/noch-nicht-fälligen Aufgaben (`listOpenTasks`) → als erledigt markieren. Löst über die Completion-Logik Intervall-Neustart + EWMA aus (s.u.).

### Einkauf (`ShoppingView`, neu)
Liste abhaken (`toggleShoppingAction`), Frische frisch↔haltbar (`toggleFreshnessAction`), „An Bring! senden" (`pushToBringAction`). Nutzt `FreshShoppingControl` + `BringSyncControl`.

### Mehr (`MoreView`, neu)
Notizen-CRUD, `PhaseSwitch` (Elternzeit-Modus, `setPhaseAction`), `PushSetupControl`, System-Status.

## Neues Backend

### Tasks
- **`createTask(input)`** (Repo) + **`addTaskAction(input)`** (Action) — Quick-Add.
- **`listOpenTasks()`** (Repo) — alle offenen/noch-nicht-fälligen Aufgaben für den Nachtragen-Picker.
- **Recurrence verdrahten:** `generateNextOccurrence` ([`web/src/lib/services/recurrence.ts`](../../../web/src/lib/services/recurrence.ts)) existiert, wird aber **nirgends aufgerufen**. Aufruf in den Done-Zweig von `setTaskStatus` ([`web/src/lib/repositories/tasks.ts`](../../../web/src/lib/repositories/tasks.ts)) einhängen (nach Buchung; nur bei `status="done"`). Der vorhandene `existingSuccessor`-Guard verhindert Duplikate.
- **Restart-Fix:** Folge-Fälligkeit ab `task.completedAt` statt `task.dueDate` rechnen → echtes „Intervall neu starten" beim frühen Nachtragen.

### Adaptives Intervall (Feature B aus „Sanftes Lernen")
- **`learnedInterval(history)`** — reine Funktion. EWMA der realen Erledigungs-Abstände einer Routine (über `recurringParentId`-Kette), α≈0,25. Liefert erst ab **N≥3** Abständen einen Wert, sonst `null`. Optionaler Klemmwert gegen einzelne Ausreißer.
- **Integration:** `generateNextOccurrence` fragt `learnedInterval` und nutzt das Ergebnis als Tages-Offset, wenn vorhanden; sonst `nextDueDate(rhythm, completedAt)`. `rhythm` bleibt sichtbarer Baseline/Fallback, manuell gesetzte Baselines werden nie überschrieben.
- **Konsistenz mit Spec:** entspricht Feature B in [`2026-06-10-sanftes-lernen-design.md`](2026-06-10-sanftes-lernen-design.md) (berechnet beim Lesen, gedämpft, transparent). Kein neues Schema nötig — nutzt vorhandene `Task.completedAt`-Historie.

### Notizen
- Modell `Note` + `getNotes` existieren. **Neu:** `createNote`, `updateNote`, `deleteNote`, `togglePinNote` (Repo) + zugehörige Actions.

## Datenfluss & Echtzeit

- Bestehende Actions revalidieren nur `revalidatePath("/")`. **Erweitern**, sodass die betroffenen `/mobile/*`-Routen mit-revalidiert werden (z.B. zusätzliche `revalidatePath`-Aufrufe pro Route bzw. `revalidatePath(path, "page")`). Damit aktualisieren Handy **und** Tablet bei jeder Mutation.
- **Shared Backend:** `/mobile` greift auf dieselben Prisma-Modelle + Server Actions wie das Tablet zu.
- **Optimistische Updates** auf interaktiven Seiten (`useOptimistic`).

## Fehlerbehandlung

- Action-Ergebnisse (`BringPushResult`, `ApprovePlanResult`) → kurze Inline-/Toast-Rückmeldung am Handy.
- Schreibfehler bleiben nicht-fatal; die UI bleibt bedienbar.

## Tests

Muster wie bestehende Engine/Repo-Tests (reine Funktionen + Repo-Tests mit injiziertem Client):

| Gegenstand | Test |
|---|---|
| `learnedInterval(history)` | Vitest, fixe Historien (Kaltstart < N → `null`; früher erledigt → kürzer; aufgeschoben → länger; Klemmwert) |
| `createTask` | Repo-Test (Pflichtfelder, Defaults) |
| Notizen-CRUD | Repo-Test (create/update/delete/pin) |
| `generateNextOccurrence` | Restart ab `completedAt`; EWMA-Offset wenn ≥N, sonst `rhythm`; `existingSuccessor`-Guard |

> ⚠️ **Projekt-Memory:** Vitest hängt unter Windows. Die Tests werden **nicht** automatisch aufgerufen — der Nutzer testet manuell.
> ⚠️ Nach `prisma migrate` ggf. `node node_modules/prisma/build/index.js generate` (Client wird sonst nicht zuverlässig regeneriert). Hier kein neues Schema nötig, daher voraussichtlich keine Migration.

## Out of Scope (Später-TODO)

- **Smarterer Einkaufszettel:**
  - Gleiche Zutaten beim Eintragen/Pushen **zusammenführen** (Duplikate mergen, ggf. Mengen addieren).
  - **Vorrats-Basics** (Salz, Pfeffer, Öl o.ä. — „hat man immer zuhause") **nicht** an Bring pushen; pflegbare Ausschluss-/Pantry-Liste.
- Komplexe Kalender-Verwaltung (bleibt nativ in Google Calendar).
- Native iOS/Android-App (bleibt PWA via Cloudflare Tunnel).
- Responsive Tablet-Dashboard für Handys (bewusst durch `/mobile` vermieden).
