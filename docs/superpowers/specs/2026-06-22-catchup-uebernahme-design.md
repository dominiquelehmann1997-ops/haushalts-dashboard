# Catch-up überfälliger Chores + Aufgaben-Übernahme — Design

Datum: 2026-06-22

## Problem

Zwei Lücken im laufenden Betrieb (entdeckt bei der Inbetriebnahme 2026-06-22):

1. **Überfällige Chores verschwinden.** Dashboard (`getTasksByPerson`) und Verteiler
   (`planDueTasks`) filtern strikt `dueDate == heute`. Recurring-Routinen rollen nur
   bei Abschluss (`generateNextOccurrence` bei `status=done`) vor. Wird eine Routine
   nicht erledigt, bleibt ihr `dueDate` in der Vergangenheit → sie ist weder sichtbar
   noch wird sie neu verteilt. Nach einer Nutzungspause stapelt sich unsichtbarer
   Rückstand; das Dashboard wirkt leer. Zusätzlich blähen alte offene
   Recurring-Erfolger-Duplikate den `openTaskCount`.

2. **Keine Übernahme-Erfassung.** Erledigt ein Erwachsener eine Aufgabe, die dem
   anderen zugewiesen ist (z.B. Dome macht Emelys "Gassi gehen"), gibt es keinen
   Weg, das einzutragen. Abhaken würde die Fairness-Punkte dem ursprünglich
   Zugewiesenen gutschreiben — falsch.

## Feature 1 — Catch-up überfälliger Routinen

### Service `rollOverdueRoutines(day, client)`

Neue, rein testbare Datei `web/src/lib/services/overdueCatchup.ts`. Wird **vor**
`planDueTasks` aufgerufen.

Ablauf:

1. Lade alle offenen standalone Routinen (`projectId = null`, `status = "open"`,
   `rhythm != null`).
2. Gruppiere nach Rhythmus-Kette `chainId = recurringParentId ?? id`.
3. **Dedupe pro Kette:** behalte die Occurrence mit dem spätesten `dueDate`; lösche
   die älteren offenen Duplikate. Offene Occurrences haben nie `completedAt` und
   damit keine `AccountEntry`-Fremdschlüssel → Löschen ist gefahrlos.
4. **Clamp:** ist die verbleibende Occurrence überfällig (`dueDate < dayBounds(day).start`),
   setze `dueDate = day` (lokale Mitternacht) und `assignedToId = null`, damit sie
   neu fair verteilt wird. Bereits heute/zukünftig fällige bleiben unberührt.

Nur Routinen (`rhythm != null`). Shopping-Tasks (`rhythm = null`, "nach Bedarf")
und Projekt-Subtasks werden nicht angefasst.

Idempotent: ein zweiter Lauf am selben Tag findet keine Duplikate mehr und keine
überfälligen (alle stehen auf heute).

### Verdrahtung

- `web/prisma/planToday.ts` (CLI `plan:today`): `rollOverdueRoutines(day)` vor
  `planDueTasks(day, …)`.
- `syncCalendarAction` (re-plant nach Kalender-Sync): ebenso vorschalten.

Da `plan:today` bei jedem Serverstart über `scripts/tablet-start.sh` läuft, wird
Rückstand bei jedem Boot eingesammelt.

## Feature 2 — Aufgaben-Übernahme

### Action `completeTaskByAction(id, doerKey)`

Neue Server-Action (Wrapper, Logik im Repo single-sourced):

1. Setze `assignedToId = doer` (Person via `doerKey` aufgelöst).
2. Rufe `setTaskStatus(id, "done", null)`.

`setTaskStatus` lädt den Task mit `assignedTo` neu und bucht über `recordCompletion`
→ die `AccountEntry`-Punkte gehen automatisch an den **Erlediger** (doer), nicht an
den ursprünglich Zugewiesenen. `generateNextOccurrence` spawnt die nächste
Occurrence unassigned wie gehabt.

Bei nur zwei Erwachsenen ist der Erlediger deterministisch der jeweils andere.

### UI

4. Eintrag im `TaskActionMenu` (Long-Press-Popover):
**„✓ Von {AndereName} erledigt"**, wobei `{Andere}` der jeweils andere Erwachsene
ist (`person === "dome" ? "Emely" : "Dome"`). Neuer Callback `onTakeOver`, durch
`TaskTile` → `Dashboard` durchgereicht; Dashboard kennt die Tile-Person und ruft
`completeTaskByAction(id, otherKey)` über eine optimistische Transition (wie
`toggleTask`). `MENU_HEIGHT` für vier Items anpassen.

## Tests (TDD)

- **`rollOverdueRoutines`**
  - Dedupe behält die neueste offene Occurrence, löscht die älteren.
  - Clamp: überfällige Occurrence → `dueDate = heute`, `assignedToId = null`.
  - Ignoriert `rhythm = null` (Shopping) und bereits heute/zukünftig fällige.
  - Idempotent: zweiter Lauf am selben Tag ist ein No-op.
- **Übernahme (Repo/Action)**
  - Gutschrift (`AccountEntry`) landet beim doer, nicht beim ursprünglich Zugewiesenen.
  - Recurring-Successor wird unassigned gespawnt.

## Deploy

Isolierter Worktree mit eigener `dev.db` (per `AGENTS.md`), TDD, dann nach `main`
mergen. Am Tablet: `git pull` → `cd web && npx next build --webpack` → Server-Neustart.
Kein Schema-/Migrations-Eingriff → Produktions-DB unberührt.

## Bewusst ausgeklammert (YAGNI)

- Personen-Auswahl bei Übernahme (>2 Erwachsene) — nicht nötig.
- Trennung "zugewiesen" vs. "erledigt von" als getrennte Felder — Reassign genügt.
- Catch-up für einmalige Todos ohne Rhythmus — Katalog enthält keine.
