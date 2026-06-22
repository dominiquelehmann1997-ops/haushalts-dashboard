# Catch-up überfälliger Routinen + Aufgaben-Übernahme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Überfällige recurring Chores landen wieder auf "heute" (+ alte offene Duplikate werden gelöscht), und eine Aufgabe kann als "vom anderen Erwachsenen erledigt" eingetragen werden, sodass die Fairness-Punkte dem echten Erlediger gutgeschrieben werden.

**Architecture:** Ein neuer reiner Service `rollOverdueRoutines(day, client)` wird in `plan:today` (CLI) und `syncCalendarAction` vor `planDueTasks` vorgeschaltet. Die Übernahme ist eine Repo-Funktion `completeTaskBy(id, doerKey, client)`, die vor dem bestehenden `setTaskStatus(…, "done")` den `assignedToId` auf den Erlediger umsetzt — die Buchung bleibt in `setTaskStatus`/`recordCompletion` single-sourced. UI: vierter Eintrag im `TaskActionMenu`.

**Tech Stack:** Next.js (Server Actions), Prisma + better-sqlite3 Adapter, Vitest, React, Tailwind.

## Global Constraints

- Isolierte Entwicklung im **git worktree** mit eigener `.env` + eigener `dev.db` — niemals direkt auf `main` im laufenden `web/`-Verzeichnis (siehe `web/AGENTS.md`). Kein `prisma migrate`/`db push` (kein Schema-Eingriff in dieser Arbeit).
- Lokale Datumsgrenzen IMMER über `dayBounds(date)` aus `@/lib/dates` (`start = 00:00:00.000`, `end = 23:59:59.999` lokal) — nie selbst rechnen.
- Routinen = `type === "routine"`; Catch-up betrifft nur `rhythm != null` und `projectId == null`.
- Personen-Keys ausschließlich `"dome"` | `"emely"`.
- Tests laufen gegen die dedizierte Test-DB über `createTestClient()` + `resetDatabase(client)` (siehe `web/src/test/db.ts`); jeder Test legt seine eigenen Rows nach dem Reset an.
- Commit-Trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Task 0: Worktree-Setup

- [ ] **Step 1: Isolierten Worktree anlegen**

REQUIRED SUB-SKILL: Use superpowers:using-git-worktrees, um den Worktree zu erstellen (Branch `feat/catchup-uebernahme`).

- [ ] **Step 2: Isolierte DB im Worktree vorbereiten**

Im Worktree (Pfad `<WORKTREE>/web`):

```bash
cd <WORKTREE>/web
cp .env.example .env   # falls keine .env vorhanden; DATABASE_URL=file:./dev.db
npm ci
npx prisma migrate deploy
node node_modules/prisma/build/index.js generate
```

Erwartet: `dev.db` existiert lokal im Worktree, getrennt von der Produktions-DB des Tablets.

- [ ] **Step 3: Test-Baseline grün**

Run: `cd <WORKTREE>/web && npx vitest run`
Expected: bestehende Suite läuft durch (grün), bevor neue Tasks beginnen.

---

## Task 1: Service `rollOverdueRoutines`

Sammelt überfällige offene Routinen ein: pro Rhythmus-Kette nur die jüngste offene Occurrence behalten (ältere löschen), und falls überfällig auf `day` ziehen + neu zuweisbar machen.

**Files:**
- Create: `web/src/lib/services/overdueCatchup.ts`
- Test: `web/src/lib/services/overdueCatchup.test.ts`

**Interfaces:**
- Consumes: `dayBounds` aus `@/lib/dates`; `PrismaClient` aus `@/generated/prisma/client`; `prisma` aus `@/lib/db`.
- Produces: `rollOverdueRoutines(day: Date, client?: PrismaClient): Promise<{ deletedDuplicates: number; rolled: number }>`

- [ ] **Step 1: Failing test schreiben**

Create `web/src/lib/services/overdueCatchup.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { dayBounds, addDays } from "@/lib/dates";

import { rollOverdueRoutines } from "./overdueCatchup";

describe("rollOverdueRoutines", () => {
  let client: PrismaClient;
  const today = new Date();

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  function makeRoutine(input: {
    title: string;
    dueDate: Date;
    rhythm?: string | null;
    recurringParentId?: string | null;
    status?: "open" | "done";
  }) {
    return client.task.create({
      data: {
        title: input.title,
        type: "routine",
        effort: 10,
        status: input.status ?? "open",
        allowedPersons: "both",
        outdoor: false,
        rhythm: input.rhythm === undefined ? "weekly" : input.rhythm,
        recurringParentId: input.recurringParentId ?? null,
        assignedToId: null,
        dueDate: input.dueDate,
      },
    });
  }

  it("zieht eine überfällige Routine auf heute und macht sie neu zuweisbar", async () => {
    const dome = await client.person.findUniqueOrThrow({ where: { key: "dome" } });
    const t = await makeRoutine({ title: "Treppe saugen", dueDate: addDays(today, -3) });
    await client.task.update({ where: { id: t.id }, data: { assignedToId: dome.id } });

    const result = await rollOverdueRoutines(today, client);

    const updated = await client.task.findUniqueOrThrow({ where: { id: t.id } });
    const { start, end } = dayBounds(today);
    expect(updated.dueDate >= start && updated.dueDate <= end).toBe(true);
    expect(updated.assignedToId).toBeNull();
    expect(result.rolled).toBe(1);
  });

  it("behält pro Kette die jüngste offene Occurrence und löscht ältere Duplikate", async () => {
    const parent = await makeRoutine({ title: "Bad putzen", dueDate: addDays(today, -9) });
    const newer = await makeRoutine({
      title: "Bad putzen",
      dueDate: addDays(today, -2),
      recurringParentId: parent.id,
    });

    const result = await rollOverdueRoutines(today, client);

    const parentRow = await client.task.findUnique({ where: { id: parent.id } });
    const newerRow = await client.task.findUnique({ where: { id: newer.id } });
    expect(parentRow).toBeNull(); // ältere Occurrence gelöscht
    expect(newerRow).not.toBeNull(); // jüngere behalten
    expect(result.deletedDuplicates).toBe(1);
    const { start, end } = dayBounds(today);
    expect(newerRow!.dueDate >= start && newerRow!.dueDate <= end).toBe(true);
  });

  it("ignoriert rhythm=null (Shopping) und bereits heute/zukünftig fällige", async () => {
    const shopping = await makeRoutine({ title: "Einkaufen", dueDate: addDays(today, -4), rhythm: null });
    const todayTask = await makeRoutine({ title: "Gassi gehen", dueDate: today, rhythm: "daily" });
    const future = await makeRoutine({ title: "Fenster putzen", dueDate: addDays(today, 5) });

    await rollOverdueRoutines(today, client);

    const s = await client.task.findUniqueOrThrow({ where: { id: shopping.id } });
    const fu = await client.task.findUniqueOrThrow({ where: { id: future.id } });
    expect(s.dueDate.getTime()).toBe(addDays(today, -4).getTime()); // unberührt
    expect(fu.dueDate.getTime()).toBe(addDays(today, 5).getTime()); // unberührt
    await client.task.findUniqueOrThrow({ where: { id: todayTask.id } }); // existiert noch
  });

  it("ist idempotent: zweiter Lauf am selben Tag ändert nichts mehr", async () => {
    await makeRoutine({ title: "Staub wischen", dueDate: addDays(today, -3) });
    await rollOverdueRoutines(today, client);
    const second = await rollOverdueRoutines(today, client);
    expect(second.rolled).toBe(0);
    expect(second.deletedDuplicates).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen → fehlschlägt**

Run: `cd <WORKTREE>/web && npx vitest run src/lib/services/overdueCatchup.test.ts`
Expected: FAIL — `rollOverdueRoutines` ist nicht definiert (Import schlägt fehl).

- [ ] **Step 3: Service implementieren**

Create `web/src/lib/services/overdueCatchup.ts`:

```ts
// Catch-up für überfällige Routinen: pro Rhythmus-Kette nur die jüngste offene
// Occurrence behalten (ältere löschen), und überfällige auf den Plantag ziehen
// + neu zuweisbar machen. Wird vor `planDueTasks` aufgerufen, damit Rückstand
// nicht unsichtbar in der Vergangenheit festhängt.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { dayBounds } from "@/lib/dates";

export async function rollOverdueRoutines(
  day: Date,
  client: PrismaClient = prisma,
): Promise<{ deletedDuplicates: number; rolled: number }> {
  const { start } = dayBounds(day);

  const open = await client.task.findMany({
    where: {
      projectId: null,
      status: "open",
      type: "routine",
      rhythm: { not: null },
    },
    orderBy: { dueDate: "asc" },
  });

  // Nach Rhythmus-Kette gruppieren (recurringParentId ?? id).
  const chains = new Map<string, typeof open>();
  for (const task of open) {
    const chainId = task.recurringParentId ?? task.id;
    const list = chains.get(chainId) ?? [];
    list.push(task);
    chains.set(chainId, list);
  }

  let deletedDuplicates = 0;
  let rolled = 0;

  for (const list of chains.values()) {
    // Jüngste (spätestes dueDate) behalten, ältere offene löschen.
    list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const keep = list[list.length - 1]!;
    const drop = list.slice(0, -1);

    for (const dupe of drop) {
      await client.task.delete({ where: { id: dupe.id } });
      deletedDuplicates += 1;
    }

    // Überfällige behaltene Occurrence auf den Plantag ziehen.
    if (keep.dueDate < start) {
      await client.task.update({
        where: { id: keep.id },
        data: { dueDate: start, assignedToId: null },
      });
      rolled += 1;
    }
  }

  return { deletedDuplicates, rolled };
}
```

- [ ] **Step 4: Test laufen lassen → grün**

Run: `cd <WORKTREE>/web && npx vitest run src/lib/services/overdueCatchup.test.ts`
Expected: PASS (4 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/overdueCatchup.ts web/src/lib/services/overdueCatchup.test.ts
git commit -m "feat(planning): rollOverdueRoutines — dedupe + clamp überfälliger Routinen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Catch-up in `plan:today` + `syncCalendarAction` verdrahten

**Files:**
- Modify: `web/prisma/planToday.ts`
- Modify: `web/src/app/actions/calendar.ts` (Funktion `syncCalendarAction`)

**Interfaces:**
- Consumes: `rollOverdueRoutines(day, client?)` aus Task 1.

- [ ] **Step 1: `plan:today` vorschalten**

In `web/prisma/planToday.ts`, Import ergänzen:

```ts
import { rollOverdueRoutines } from "../src/lib/services/overdueCatchup";
```

Im `try`-Block, **direkt vor** `const decisions = await planDueTasks(...)`:

```ts
    const caught = await rollOverdueRoutines(day);
    console.log(
      `Catch-up: ${caught.rolled} überfällige Routinen auf heute gezogen, ` +
        `${caught.deletedDuplicates} Duplikate entfernt.`,
    );
```

- [ ] **Step 2: `syncCalendarAction` vorschalten**

Öffne `web/src/app/actions/calendar.ts`. Finde die Stelle, an der nach dem Sync neu geplant wird (Aufruf von `planDueTasks` bzw. der Planungs-Service). Ergänze den Import:

```ts
import { rollOverdueRoutines } from "@/lib/services/overdueCatchup";
```

und rufe **unmittelbar vor** der Neuplanung auf:

```ts
  await rollOverdueRoutines(day);
```

(`day` = der bereits in der Action verwendete lokale Plantag; falls die Action `planDueTasks(today, …)` o.ä. nutzt, denselben Wert übergeben.)

- [ ] **Step 3: Verdrahtung verifizieren (Catch-up läuft vor Planung)**

Run: `cd <WORKTREE>/web && npx vitest run`
Expected: gesamte Suite grün (keine Regression). 

Manueller Smoke gegen die isolierte Worktree-DB:

```bash
cd <WORKTREE>/web
npx tsx -e "import('better-sqlite3').then(m=>{const D=m.default('dev.db');const id=D.prepare('select id from Task where rhythm is not null and projectId is null limit 1').get().id;D.prepare(\"update Task set status='open', dueDate='2026-01-01T00:00:00.000+00:00', assignedToId=null where id=?\").run(id);console.log('overdue gesetzt:',id);})"
npm run plan:today
```
Expected: Ausgabe enthält `Catch-up: 1 überfällige Routinen auf heute gezogen` (oder mehr) und danach die Verteilungszeile.

- [ ] **Step 4: Commit**

```bash
git add web/prisma/planToday.ts web/src/app/actions/calendar.ts
git commit -m "feat(planning): catch-up vor planDueTasks in plan:today + syncCalendarAction

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Repo `completeTaskBy` + Server-Action `completeTaskByAction`

Reassign-an-Erlediger + Abschluss, Buchung über bestehendes `setTaskStatus`.

**Files:**
- Modify: `web/src/lib/repositories/tasks.ts` (neue Funktion `completeTaskBy`)
- Test: `web/src/lib/repositories/tasks.test.ts` (anlegen, falls nicht vorhanden; sonst ergänzen)
- Modify: `web/src/app/actions/tasks.ts` (neue Action `completeTaskByAction`)

**Interfaces:**
- Consumes: `setTaskStatus(id, status, reason, client?)` (bereits in `tasks.ts`); `prisma`, `PrismaClient`.
- Produces:
  - `completeTaskBy(id: string, doerKey: "dome" | "emely", client?: PrismaClient): Promise<void>`
  - `completeTaskByAction(id: string, doerKey: "dome" | "emely"): Promise<void>`

- [ ] **Step 1: Failing test schreiben**

Falls `web/src/lib/repositories/tasks.test.ts` existiert, den `describe`-Block ergänzen; sonst Datei anlegen mit:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { completeTaskBy } from "./tasks";

describe("completeTaskBy", () => {
  let client: PrismaClient;
  const today = new Date();

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("schreibt die Punkte dem Erlediger gut, nicht dem ursprünglich Zugewiesenen", async () => {
    const emely = await client.person.findUniqueOrThrow({ where: { key: "emely" } });
    const task = await client.task.create({
      data: {
        title: "Gassi gehen",
        type: "routine",
        effort: 45,
        status: "open",
        allowedPersons: "both",
        outdoor: false,
        rhythm: "daily",
        assignedToId: emely.id,
        dueDate: today,
      },
    });

    await completeTaskBy(task.id, "dome", client);

    const entries = await client.accountEntry.findMany({
      where: { taskId: task.id },
      include: { person: true },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.person.key).toBe("dome");
    expect(entries[0]!.points).toBe(45);

    const updated = await client.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.status).toBe("done");
  });
});
```

- [ ] **Step 2: Test laufen lassen → fehlschlägt**

Run: `cd <WORKTREE>/web && npx vitest run src/lib/repositories/tasks.test.ts`
Expected: FAIL — `completeTaskBy` ist nicht exportiert.

- [ ] **Step 3: `completeTaskBy` implementieren**

In `web/src/lib/repositories/tasks.ts` am Dateiende ergänzen:

```ts
/**
 * Schließt eine Aufgabe im Namen des *tatsächlichen* Erledigers ab: setzt
 * `assignedToId` auf `doerKey` und ruft dann `setTaskStatus(…, "done")`. Da die
 * Buchung in `setTaskStatus`/`recordCompletion` an `assignedTo` hängt, gehen die
 * Fairness-Punkte an den Erlediger. Recurring spawnt die nächste Occurrence
 * unassigned wie gehabt.
 */
export async function completeTaskBy(
  id: string,
  doerKey: "dome" | "emely",
  client: PrismaClient = prisma,
): Promise<void> {
  const person = await client.person.findUniqueOrThrow({ where: { key: doerKey } });
  await client.task.update({ where: { id }, data: { assignedToId: person.id } });
  await setTaskStatus(id, "done", null, client);
}
```

- [ ] **Step 4: Test laufen lassen → grün**

Run: `cd <WORKTREE>/web && npx vitest run src/lib/repositories/tasks.test.ts`
Expected: PASS.

- [ ] **Step 5: Server-Action ergänzen**

In `web/src/app/actions/tasks.ts` Import erweitern und Action anhängen:

```ts
import { deferTask, setTaskStatus, createTask, completeTaskBy, type CreateTaskInput } from "@/lib/repositories/tasks";
```

```ts
/** Schließt eine fremd zugewiesene Aufgabe als vom Erlediger erledigt ab. */
export async function completeTaskByAction(
  id: string,
  doerKey: "dome" | "emely",
): Promise<void> {
  await completeTaskBy(id, doerKey);
  revalidateDashboard();
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/repositories/tasks.ts web/src/lib/repositories/tasks.test.ts web/src/app/actions/tasks.ts
git commit -m "feat(tasks): completeTaskBy — Übernahme bucht Punkte beim Erlediger

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: UI — Übernahme-Eintrag im TaskActionMenu

**Files:**
- Modify: `web/src/components/TaskActionMenu.tsx`
- Modify: `web/src/components/tiles.tsx` (TaskRow + TaskTile: `onTakeOver` durchreichen)
- Modify: `web/src/components/dashboard.tsx` (`takeOver`-Handler + Action-Aufruf)

**Interfaces:**
- Consumes: `completeTaskByAction(id, doerKey)` aus Task 3.
- Produces (Props): `TaskActionMenu` erhält zusätzlich `onTakeOver: () => void` und `takeOverLabel: string`; `TaskTile` erhält `onTakeOver: (id: string, doerKey: "dome" | "emely") => void`.

- [ ] **Step 1: TaskActionMenu erweitern**

In `web/src/components/TaskActionMenu.tsx`:

`MENU_HEIGHT` anpassen (vier Items):

```ts
const MENU_HEIGHT = 164; // four menu items, ~41px each
```

Props-Signatur erweitern:

```ts
export function TaskActionMenu({
  position,
  onDone,
  onDefer,
  onFail,
  onTakeOver,
  takeOverLabel,
  onClose,
}: {
  position: { x: number; y: number };
  onDone: () => void;
  onDefer: () => void;
  onFail: () => void;
  onTakeOver: () => void;
  takeOverLabel: string;
  onClose: () => void;
}) {
```

Im Menü-Container nach dem "Geht heute nicht"-Item ergänzen:

```tsx
        <MenuItem label="✓ Erledigt" run={onDone} onClose={onClose} />
        <MenuItem label="→ Aufschieben" run={onDefer} onClose={onClose} />
        <MenuItem label="✕ Geht heute nicht" run={onFail} onClose={onClose} />
        <MenuItem label={takeOverLabel} run={onTakeOver} onClose={onClose} />
```

- [ ] **Step 2: tiles.tsx — onTakeOver durchreichen**

In `web/src/components/tiles.tsx`:

Die TaskRow-Komponente (die `TaskActionMenu` rendert) braucht Zugriff auf die Tile-Person, um den jeweils anderen Erwachsenen zu bestimmen. Dazu in der TaskRow-Props `person` und `onTakeOver` ergänzen (analog zu `onToggle`/`onDefer`/`onFail`). Innerhalb der TaskRow:

```tsx
  const otherKey: "dome" | "emely" = person === "dome" ? "emely" : "dome";
  const otherName = PERSON[otherKey].name;
```

Den `TaskActionMenu`-Aufruf erweitern:

```tsx
        <TaskActionMenu
          position={menuPosition}
          onDone={() => onToggle(task.id)}
          onDefer={() => onDefer(task.id)}
          onFail={() => onFail(task.id)}
          onTakeOver={() => onTakeOver(task.id, otherKey)}
          takeOverLabel={`✓ Von ${otherName} erledigt`}
          onClose={() => setMenuOpen(false)}
        />
```

In `TaskTile` die Prop `onTakeOver: (id: string, doerKey: "dome" | "emely") => void` zur Signatur hinzufügen und an jede TaskRow weiterreichen (zusammen mit `person`).

- [ ] **Step 3: dashboard.tsx — Handler + Action**

In `web/src/components/dashboard.tsx`:

Import erweitern:

```ts
import { toggleTaskAction, deferTaskAction, failTaskAction, completeTaskByAction } from "@/app/actions/tasks";
```

Handler ergänzen (optimistisch wie `toggleTask` — Aufgabe wird `done`):

```ts
  const takeOver = (id: string, doerKey: "dome" | "emely") => {
    startTransition(async () => {
      applyTaskOptimistic({ id, type: "toggle" });
      await completeTaskByAction(id, doerKey);
    });
  };
```

An beide `TaskTile` (dome + emely) die Prop weitergeben:

```tsx
          <TaskTile person="dome" tasks={domeTasks} onToggle={toggleTask} onDefer={deferTask} onFail={failTask} onTakeOver={takeOver} />
```
```tsx
          <TaskTile person="emely" tasks={emelyTasks} onToggle={toggleTask} onDefer={deferTask} onFail={failTask} onTakeOver={takeOver} />
```

- [ ] **Step 4: Typecheck + Build**

Run: `cd <WORKTREE>/web && npx tsc --noEmit`
Expected: keine Typfehler.

Run: `cd <WORKTREE>/web && npx vitest run`
Expected: gesamte Suite grün.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TaskActionMenu.tsx web/src/components/tiles.tsx web/src/components/dashboard.tsx
git commit -m "feat(ui): Übernahme-Eintrag im TaskActionMenu (Von X erledigt)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Merge + Tablet-Deploy

- [ ] **Step 1: Voller Lauf grün**

Run: `cd <WORKTREE>/web && npx vitest run && npx tsc --noEmit`
Expected: alles grün.

- [ ] **Step 2: Nach main mergen**

```bash
cd <MAIN-REPO>
git checkout main
git merge --no-ff feat/catchup-uebernahme
git push origin main
```

REQUIRED SUB-SKILL: Use superpowers:finishing-a-development-branch zum Aufräumen des Worktree/Branch.

- [ ] **Step 3: Auf dem Tablet deployen**

```bash
ssh -p 8022 u0_a353@192.168.178.91 'bash -lc "cd ~/haushalts-dashboard && git pull && cd web && npx next build --webpack"'
```
Expected: Build erfolgreich.

- [ ] **Step 4: Server neu starten (Next-Prozess ersetzen)**

```bash
ssh -p 8022 u0_a353@192.168.178.91 'bash -lc "pkill -f \"next start\"; cd ~/haushalts-dashboard && termux-wake-lock; setsid bash scripts/tablet-start.sh >\$HOME/dashboard.log 2>&1 </dev/null & sleep 15; curl -sf -o /dev/null -w \"%{http_code}\\n\" http://127.0.0.1:3001/"'
```
Expected: `200`. (cloudflared läuft weiter; nur der Next-Server wird ersetzt.) `scripts/tablet-start.sh` ruft beim Start `plan:today` → der Catch-up läuft hier real einmal durch.

- [ ] **Step 5: End-to-End am Tablet prüfen**

Dashboard neu laden: Aufgaben sichtbar; Long-Press auf eine Aufgabe → vierter Menüpunkt „✓ Von {Name} erledigt"; Auswahl bucht Punkte beim anderen Erwachsenen (Konto-Split aktualisiert nach Revalidate).

---

## Self-Review-Ergebnis

- **Spec-Coverage:** Feature 1 (Service Task 1, Verdrahtung Task 2, Dedupe in Task 1), Feature 2 (Repo/Action Task 3, UI Task 4), Deploy Task 5 — alle Spec-Abschnitte abgedeckt.
- **Platzhalter:** keine offenen TODO/TBD; jeder Code-Step enthält vollständigen Code.
- **Typkonsistenz:** `rollOverdueRoutines(day, client?)`, `completeTaskBy(id, doerKey, client?)`, `completeTaskByAction(id, doerKey)`, Props `onTakeOver(id, doerKey)` + `takeOverLabel` durchgängig identisch verwendet.
- **Annahme zu prüfen (Task 2):** exakte Re-Plan-Stelle in `web/src/app/actions/calendar.ts` beim Implementieren verifizieren (Funktion `syncCalendarAction`, vorhandener `planDueTasks`-Aufruf).
