# Handy-Vollsteuerung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/mobile` control the whole dashboard — re-skinned to the tablet's cream/ink/dome/emely design concept, with 5-tab navigation, quick-add tasks, persistent notes CRUD, and wired-up recurring-task completion that restarts the interval and adapts it via a learned EWMA.

**Architecture:** Next.js App Router. The `(mobile)` route group already has its own layout and shares the tablet's Prisma repositories + Server Actions. This plan (1) adds missing backend (task creation, notes CRUD, recurrence wiring, learned interval), (2) extends action revalidation to cover `/mobile/*`, and (3) rebuilds the mobile pages with the existing `Card`/`CardHead`/`PersonBadge` design system and reused tablet components.

**Tech Stack:** Next.js (App Router, Server Actions), React (`useOptimistic`/`useTransition`), Prisma + SQLite, Tailwind v4 (`@theme` tokens in `globals.css`), Vitest, lucide-react icons.

## Global Constraints

- UI language: **Deutsch**.
- Design tokens come from `web/src/app/globals.css`: `cream` (#f7f3ec), `ink`/`ink-soft`/`ink-faint`, `dome`/`emely` (+ `-deep`/`-soft`/`-tint`), `shadow-card`, `radius-xl2` (1.75rem), `.rise` animation. **Reuse `<Card>`, `<CardHead>`, `<PersonBadge>` from `web/src/components/ui.tsx`** — do not hand-roll card styling.
- Theme: cream-light default + automatic dark via `prefers-color-scheme`. Existing components already carry `dark:` classes.
- Person color code: `PERSON` from `web/src/lib/data.ts` (Dome = teal, Emely = coral).
- **Vitest hangs on Windows (project memory): do NOT run vitest automatically. The user runs tests manually.** Where a step says "run the test", leave it for the user; agents verify backend tasks by writing the test + implementation and running `npx tsc --noEmit` only.
- After any `prisma migrate`, run `node node_modules/prisma/build/index.js generate`. **This plan needs no schema change** (all fields/models exist), so no migration is expected.
- All repository functions take an optional `client: PrismaClient = prisma` last parameter (testability pattern). Follow it.
- Server Actions are thin wrappers: mutate via repository, then revalidate. No business logic in actions.
- Frequent commits: one per task minimum, conventional-commit messages.
- Work happens under `web/`. All paths below are relative to repo root.

---

## File Structure

**New backend:**
- `web/src/lib/services/learnedInterval.ts` — pure EWMA function (Feature B).
- `web/src/lib/revalidate.ts` — shared `revalidateDashboard()` helper.

**Modified backend:**
- `web/src/lib/services/recurrence.ts` — restart-from-completion + learnedInterval integration; wire into completion.
- `web/src/lib/repositories/tasks.ts` — call recurrence in `setTaskStatus` done-branch; add `createTask`, `listOpenTasks`.
- `web/src/lib/repositories/notes.ts` — add `createNote`, `updateNote`, `deleteNote`, `togglePinNote`; extend `getNotes` DTO with `pinned`.
- `web/src/lib/data.ts` — add optional `pinned?: boolean` to `Note` type.
- `web/src/app/actions/tasks.ts` — add `addTaskAction`; use `revalidateDashboard()`.
- `web/src/app/actions/notes.ts` (new) — note CRUD actions.
- `web/src/app/actions/{meals,shopping,phase,accounts}.ts` — swap `revalidatePath("/")` → `revalidateDashboard()`.

**Mobile UI:**
- `web/src/app/(mobile)/layout.tsx` — re-skin shell.
- `web/src/components/mobile/MobileNavBar.tsx` — 5 tabs, cream.
- `web/src/components/mobile/PageHeader.tsx` (new).
- `web/src/app/(mobile)/mobile/page.tsx` — real Heute page.
- `web/src/components/mobile/TodayView.tsx` (new).
- `web/src/app/(mobile)/mobile/tasks/page.tsx` + `web/src/components/mobile/TasksView.tsx` (new).
- `web/src/app/(mobile)/mobile/shopping/page.tsx` + `web/src/components/mobile/ShoppingView.tsx` (new).
- `web/src/app/(mobile)/mobile/more/page.tsx` + `web/src/components/mobile/MoreView.tsx` + `web/src/components/mobile/NotesEditor.tsx` (new).
- `web/src/app/(mobile)/mobile/meals/page.tsx` — re-skinned header (uses `PageHeader`).
- Delete `web/src/app/(mobile)/mobile/notes/page.tsx` and `.../settings/page.tsx` (content folds into Heute/More).

---

## Task 1: `learnedInterval` pure function

**Files:**
- Create: `web/src/lib/services/learnedInterval.ts`
- Test: `web/src/lib/services/learnedInterval.test.ts`

**Interfaces:**
- Produces: `learnedInterval(intervalsInDays: number[]): number | null`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/services/learnedInterval.test.ts
import { describe, expect, it } from "vitest";
import { learnedInterval } from "./learnedInterval";

describe("learnedInterval", () => {
  it("returns null below the minimum observation count (N<3 intervals)", () => {
    expect(learnedInterval([])).toBeNull();
    expect(learnedInterval([7])).toBeNull();
    expect(learnedInterval([7, 7])).toBeNull();
  });

  it("returns the steady interval when completions are evenly spaced", () => {
    expect(learnedInterval([7, 7, 7])).toBeCloseTo(7, 5);
  });

  it("pulls the interval DOWN when recent completions get closer together (done early)", () => {
    // weekly routine, last gaps shrinking
    const learned = learnedInterval([7, 5, 3]);
    expect(learned).not.toBeNull();
    expect(learned!).toBeLessThan(7);
  });

  it("pushes the interval UP when recent gaps grow (kept being deferred)", () => {
    const learned = learnedInterval([7, 9, 12]);
    expect(learned!).toBeGreaterThan(7);
  });

  it("weights the most recent gap most (EWMA alpha=0.25)", () => {
    // ewma seeded at first, folded: 10 -> 0.25*10+0.75*10=10 -> 0.25*4+0.75*10=8.5
    expect(learnedInterval([10, 10, 4])).toBeCloseTo(8.5, 5);
  });
});
```

- [ ] **Step 2: (User) run the test to confirm it fails** — `npx vitest run src/lib/services/learnedInterval.test.ts`. Expected: FAIL (module not found). *Agent: skip running vitest; proceed.*

- [ ] **Step 3: Write the implementation**

```ts
// web/src/lib/services/learnedInterval.ts

// Feature B (Sanftes Lernen): learned task interval.
// EWMA of the REAL gaps (in days) between a routine's completions. Damped:
// needs at least MIN_INTERVALS observed gaps before it counts; otherwise the
// configured `rhythm` stays the source of truth. Pure — no DB, no clock.

const ALPHA = 0.25;
const MIN_INTERVALS = 3;

/**
 * Exponentially-weighted moving average of completion gaps (oldest → newest).
 * Returns `null` until at least MIN_INTERVALS gaps exist, so the caller falls
 * back to the configured rhythm. The most recent gap carries the most weight.
 */
export function learnedInterval(intervalsInDays: number[]): number | null {
  if (intervalsInDays.length < MIN_INTERVALS) return null;

  let ewma = intervalsInDays[0]!;
  for (let i = 1; i < intervalsInDays.length; i++) {
    ewma = ALPHA * intervalsInDays[i]! + (1 - ALPHA) * ewma;
  }
  return ewma;
}
```

- [ ] **Step 4: (User) run the test to confirm it passes** — `npx vitest run src/lib/services/learnedInterval.test.ts`. Expected: PASS. *Agent: run `npx tsc --noEmit` instead and confirm no errors.*

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/learnedInterval.ts web/src/lib/services/learnedInterval.test.ts
git commit -m "feat(learning): learnedInterval EWMA pure function (Feature B)"
```

---

## Task 2: Wire recurrence into completion (restart-from-completion + learned interval)

**Files:**
- Modify: `web/src/lib/services/recurrence.ts`
- Modify: `web/src/lib/repositories/tasks.ts:101-156` (`setTaskStatus`)
- Test: `web/src/lib/services/recurrence.test.ts` (extend existing if present, else create)

**Interfaces:**
- Consumes: `learnedInterval(intervalsInDays: number[]): number | null` (Task 1); existing `nextDueDate(rhythm, from)`.
- Produces: `generateNextOccurrence(taskId, client?)` now bases the successor's `dueDate` on the routine's `completedAt` (fallback `dueDate`) and uses the learned interval when available. `setTaskStatus(...,"done",...)` spawns the next occurrence.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/services/recurrence.test.ts  (add these cases; keep any existing ones)
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { generateNextOccurrence } from "./recurrence";

describe("generateNextOccurrence — restart + learned interval", () => {
  let client: PrismaClient;
  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });
  afterAll(async () => {
    await client?.$disconnect();
  });

  it("bases the next dueDate on completedAt, not the old dueDate (interval restart)", async () => {
    const due = new Date("2026-01-01T00:00:00.000Z");
    const completedAt = new Date("2026-01-10T12:00:00.000Z"); // done 9 days late
    const routine = await client.task.create({
      data: {
        title: "Test-Routine", type: "routine", effort: 10, allowedPersons: "both",
        rhythm: "weekly", status: "done", dueDate: due, completedAt,
      },
    });

    const next = await generateNextOccurrence(routine.id, client);

    expect(next).not.toBeNull();
    // weekly = +7 days from completedAt (2026-01-10), NOT from dueDate (2026-01-01)
    expect(next!.dueDate.toISOString().slice(0, 10)).toBe("2026-01-17");
  });

  it("uses the learned interval once enough completions exist in the chain", async () => {
    // Build a chain of 4 completions ~3 days apart -> learned < weekly(7)
    const chainBase = await client.task.create({
      data: {
        title: "Häufige Routine", type: "routine", effort: 5, allowedPersons: "both",
        rhythm: "weekly", status: "done",
        dueDate: new Date("2026-02-01"), completedAt: new Date("2026-02-01"),
      },
    });
    const days = ["2026-02-04", "2026-02-07", "2026-02-10"];
    let last = chainBase;
    for (const d of days) {
      last = await client.task.create({
        data: {
          title: "Häufige Routine", type: "routine", effort: 5, allowedPersons: "both",
          rhythm: "weekly", status: "done", recurringParentId: chainBase.id,
          dueDate: new Date(d), completedAt: new Date(d),
        },
      });
    }

    const next = await generateNextOccurrence(last.id, client);

    expect(next).not.toBeNull();
    // gaps ~3 days -> next due ~3 days after 2026-02-10, well before +7 (2026-02-17)
    const offsetDays =
      (next!.dueDate.getTime() - new Date("2026-02-10").getTime()) / 86_400_000;
    expect(offsetDays).toBeLessThan(7);
    expect(offsetDays).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: (User) run the test to confirm it fails.** *Agent: skip; proceed.*

- [ ] **Step 3: Update `generateNextOccurrence`** in `web/src/lib/services/recurrence.ts`. Add the import and replace the `client.task.create` block's `dueDate` computation with a completion-based, learned-interval-aware date.

Add at top of file (after existing imports):

```ts
import { learnedInterval } from "@/lib/services/learnedInterval";

const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;

/** Real completion gaps (in days) for a routine chain, oldest → newest. */
async function chainCompletionGaps(chainId: string, client: PrismaClient): Promise<number[]> {
  const done = await client.task.findMany({
    where: {
      OR: [{ recurringParentId: chainId }, { id: chainId }],
      status: "done",
      completedAt: { not: null },
    },
    orderBy: { completedAt: "asc" },
    select: { completedAt: true },
  });
  const gaps: number[] = [];
  for (let i = 1; i < done.length; i++) {
    const prev = done[i - 1]!.completedAt!.getTime();
    const cur = done[i]!.completedAt!.getTime();
    gaps.push((cur - prev) / DAY_MS_LOCAL);
  }
  return gaps;
}
```

Then, inside `generateNextOccurrence`, after the `existingSuccessor` guard and before the `return client.task.create(...)`, compute the base + due date:

```ts
  // Interval restart: count from when it was actually done, not the old plan date.
  const base = task.completedAt ?? task.dueDate;

  const learned = learnedInterval(await chainCompletionGaps(chainId, client));
  const nextDue =
    learned != null
      ? new Date(base.getTime() + Math.round(learned) * DAY_MS_LOCAL)
      : nextDueDate(task.rhythm, base);
```

And change the created record's `dueDate: nextDueDate(task.rhythm, task.dueDate)` to `dueDate: nextDue`.

- [ ] **Step 4: Wire it into completion.** In `web/src/lib/repositories/tasks.ts`, import and call the generator at the end of the `status === "done"` branch of `setTaskStatus`.

Add import near the top (with the other service imports):

```ts
import { generateNextOccurrence } from "@/lib/services/recurrence";
```

At the very end of `setTaskStatus`, after the `if (status === "done") { ... }` booking block closes, add:

```ts
  // Recurring routines spawn their next open occurrence once done (idempotent:
  // generateNextOccurrence no-ops for non-routines and guards against duplicates).
  if (status === "done") {
    await generateNextOccurrence(id, client);
  }
```

- [ ] **Step 5: Typecheck.** Run `npx tsc --noEmit`. Expected: no errors. (User runs `npx vitest run src/lib/services/recurrence.test.ts src/lib/repositories/tasks.write.test.ts` and confirms green.)

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/services/recurrence.ts web/src/lib/services/recurrence.test.ts web/src/lib/repositories/tasks.ts
git commit -m "feat(tasks): spawn next occurrence on completion, restart interval from completedAt + learned EWMA"
```

---

## Task 3: `createTask` + `listOpenTasks` repository + `addTaskAction`

**Files:**
- Modify: `web/src/lib/repositories/tasks.ts`
- Modify: `web/src/app/actions/tasks.ts`
- Test: `web/src/lib/repositories/tasks.write.test.ts` (extend)

**Interfaces:**
- Produces:
  - `createTask(input: CreateTaskInput, client?): Promise<{ id: string }>` where
    `CreateTaskInput = { title: string; type?: string; effort: number; allowedPersons: "both" | "dome" | "emely"; dueDate: Date; rhythm?: string | null; icon?: string | null; assignToKey?: "dome" | "emely" | null }`
  - `listOpenTasks(client?): Promise<OpenTaskDTO[]>` where
    `OpenTaskDTO = { id: string; title: string; icon: string; person: "dome" | "emely" | null; dueDateISO: string; rhythm: string | null }`
  - `addTaskAction(input: AddTaskInput): Promise<void>` where `AddTaskInput` mirrors `CreateTaskInput` but with `dueDateISO: string` instead of `dueDate: Date`.

- [ ] **Step 1: Write the failing test** (append to `tasks.write.test.ts`)

```ts
  describe("createTask", () => {
    it("creates an open standalone task assigned to a person on the given day", async () => {
      const due = new Date("2026-03-01");
      const { id } = await createTask(
        { title: "Spontan: Fenster putzen", effort: 15, allowedPersons: "dome", dueDate: due, assignToKey: "dome" },
        client,
      );
      const row = await client.task.findUniqueOrThrow({ where: { id }, include: { assignedTo: true } });
      expect(row.status).toBe("open");
      expect(row.type).toBe("todo");
      expect(row.effort).toBe(15);
      expect(row.assignedTo?.key).toBe("dome");
      expect(row.projectId).toBeNull();
    });

    it("leaves assignedTo null when no person is given", async () => {
      const { id } = await createTask(
        { title: "Unzugeordnet", effort: 5, allowedPersons: "both", dueDate: new Date("2026-03-02") },
        client,
      );
      const row = await client.task.findUniqueOrThrow({ where: { id } });
      expect(row.assignedToId).toBeNull();
    });
  });

  describe("listOpenTasks", () => {
    it("returns only open standalone tasks, ordered by dueDate asc", async () => {
      const open = await listOpenTasks(client);
      expect(open.length).toBeGreaterThan(0);
      expect(open.every((t) => typeof t.id === "string")).toBe(true);
      const dues = open.map((t) => t.dueDateISO);
      expect([...dues].sort()).toEqual(dues);
    });
  });
```

Add to the import line at the top of the test file: `import { assignTask, setTaskStatus, createTask, listOpenTasks } from "./tasks";`

- [ ] **Step 2: (User) run to confirm fail.** *Agent: skip.*

- [ ] **Step 3: Implement in `web/src/lib/repositories/tasks.ts`**

```ts
export interface CreateTaskInput {
  title: string;
  type?: string; // default "todo"
  effort: number;
  allowedPersons: "both" | "dome" | "emely";
  dueDate: Date;
  rhythm?: string | null;
  icon?: string | null;
  assignToKey?: "dome" | "emely" | null;
}

/** Creates an open standalone task. Resolves `assignToKey` to a Person id when given. */
export async function createTask(
  input: CreateTaskInput,
  client: PrismaClient = prisma,
): Promise<{ id: string }> {
  let assignedToId: string | null = null;
  if (input.assignToKey) {
    const person = await client.person.findUniqueOrThrow({ where: { key: input.assignToKey } });
    assignedToId = person.id;
  }
  const task = await client.task.create({
    data: {
      title: input.title,
      type: input.type ?? "todo",
      effort: input.effort,
      allowedPersons: input.allowedPersons,
      rhythm: input.rhythm ?? null,
      icon: input.icon ?? null,
      status: "open",
      dueDate: input.dueDate,
      assignedToId,
    },
    select: { id: true },
  });
  return task;
}

export interface OpenTaskDTO {
  id: string;
  title: string;
  icon: string;
  person: "dome" | "emely" | null;
  dueDateISO: string;
  rhythm: string | null;
}

/** All open standalone tasks (incl. not-yet-due), for the "Erledigt nachtragen" picker. */
export async function listOpenTasks(client: PrismaClient = prisma): Promise<OpenTaskDTO[]> {
  const rows = await client.task.findMany({
    where: { projectId: null, status: "open" },
    include: { assignedTo: true },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    icon: r.icon ?? "",
    person: r.assignedTo?.key === "dome" || r.assignedTo?.key === "emely" ? r.assignedTo.key : null,
    dueDateISO: r.dueDate.toISOString(),
    rhythm: r.rhythm ?? null,
  }));
}
```

- [ ] **Step 4: Add `addTaskAction`** to `web/src/app/actions/tasks.ts` (and switch the file's `revalidatePath("/")` calls to `revalidateDashboard()` — see Task 5; if Task 5 not done yet, leave `revalidatePath("/")` and revisit).

```ts
import { createTask, type CreateTaskInput } from "@/lib/repositories/tasks";

export interface AddTaskInput {
  title: string;
  type?: string;
  effort: number;
  allowedPersons: "both" | "dome" | "emely";
  dueDateISO: string;
  rhythm?: string | null;
  icon?: string | null;
  assignToKey?: "dome" | "emely" | null;
}

/** Creates a new standalone task from the mobile quick-add form. */
export async function addTaskAction(input: AddTaskInput): Promise<void> {
  const repoInput: CreateTaskInput = {
    title: input.title,
    type: input.type,
    effort: input.effort,
    allowedPersons: input.allowedPersons,
    dueDate: new Date(input.dueDateISO),
    rhythm: input.rhythm,
    icon: input.icon,
    assignToKey: input.assignToKey,
  };
  await createTask(repoInput);
  revalidateDashboard();
}
```

- [ ] **Step 5: Typecheck.** `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/repositories/tasks.ts web/src/lib/repositories/tasks.write.test.ts web/src/app/actions/tasks.ts
git commit -m "feat(tasks): createTask + listOpenTasks repo and addTaskAction"
```

---

## Task 4: Notes CRUD repository + actions

**Files:**
- Modify: `web/src/lib/data.ts` (add `pinned?` to `Note`)
- Modify: `web/src/lib/repositories/notes.ts`
- Create: `web/src/app/actions/notes.ts`
- Test: `web/src/lib/repositories/notes.test.ts` (extend)

**Interfaces:**
- Produces:
  - `createNote(input: { text: string; icon?: string | null; pinned?: boolean; date?: Date | null }, client?): Promise<{ id: string }>`
  - `updateNote(id: string, input: { text?: string; icon?: string | null; pinned?: boolean }, client?): Promise<void>`
  - `deleteNote(id: string, client?): Promise<void>`
  - `togglePinNote(id: string, client?): Promise<void>`
  - `getNotes` DTO gains `pinned: boolean`.
  - Actions: `createNoteAction(input)`, `updateNoteAction(id, input)`, `deleteNoteAction(id)`, `togglePinNoteAction(id)` — all `Promise<void>`.

- [ ] **Step 1: Add `pinned?` to the `Note` type** in `web/src/lib/data.ts` (find `export interface Note` and add the field):

```ts
export interface Note {
  id: string;
  icon: string;
  text: string;
  pinned?: boolean;
}
```

- [ ] **Step 2: Write the failing test** (append to `web/src/lib/repositories/notes.test.ts`)

```ts
  describe("notes CRUD", () => {
    it("creates, updates, pins and deletes a note", async () => {
      const { id } = await createNote({ text: "Kita anrufen", icon: "📞" }, client);
      let note = await client.note.findUniqueOrThrow({ where: { id } });
      expect(note.text).toBe("Kita anrufen");
      expect(note.pinned).toBe(false);

      await updateNote(id, { text: "Kita morgen anrufen" }, client);
      note = await client.note.findUniqueOrThrow({ where: { id } });
      expect(note.text).toBe("Kita morgen anrufen");

      await togglePinNote(id, client);
      note = await client.note.findUniqueOrThrow({ where: { id } });
      expect(note.pinned).toBe(true);

      await deleteNote(id, client);
      expect(await client.note.findUnique({ where: { id } })).toBeNull();
    });

    it("getNotes exposes the pinned flag, pinned first", async () => {
      await createNote({ text: "A", pinned: false }, client);
      await createNote({ text: "B", pinned: true }, client);
      const notes = await getNotes(client);
      expect(notes[0]?.pinned).toBe(true);
      expect(notes.every((n) => typeof n.pinned === "boolean")).toBe(true);
    });
  });
```

Update the test file's import to include the new functions: `import { getNotes, createNote, updateNote, deleteNote, togglePinNote } from "./notes";`

- [ ] **Step 3: (User) run to confirm fail.** *Agent: skip.*

- [ ] **Step 4: Implement in `web/src/lib/repositories/notes.ts`.** Extend `getNotes`'s map to include `pinned: row.pinned`, then add:

```ts
export async function createNote(
  input: { text: string; icon?: string | null; pinned?: boolean; date?: Date | null },
  client: PrismaClient = prisma,
): Promise<{ id: string }> {
  const row = await client.note.create({
    data: {
      text: input.text,
      icon: input.icon ?? null,
      pinned: input.pinned ?? false,
      date: input.date ?? null,
    },
    select: { id: true },
  });
  return row;
}

export async function updateNote(
  id: string,
  input: { text?: string; icon?: string | null; pinned?: boolean },
  client: PrismaClient = prisma,
): Promise<void> {
  await client.note.update({ where: { id }, data: input });
}

export async function deleteNote(id: string, client: PrismaClient = prisma): Promise<void> {
  await client.note.delete({ where: { id } });
}

export async function togglePinNote(id: string, client: PrismaClient = prisma): Promise<void> {
  const note = await client.note.findUniqueOrThrow({ where: { id } });
  await client.note.update({ where: { id }, data: { pinned: !note.pinned } });
}
```

In the existing `getNotes` map, change the returned object to:

```ts
  return rows.map((row) => ({
    id: row.id,
    icon: row.icon ?? "",
    text: row.text,
    pinned: row.pinned,
  }));
```

- [ ] **Step 5: Create `web/src/app/actions/notes.ts`**

```ts
"use server";

import { revalidateDashboard } from "@/lib/revalidate";
import { createNote, updateNote, deleteNote, togglePinNote } from "@/lib/repositories/notes";

export async function createNoteAction(input: { text: string; icon?: string | null; pinned?: boolean }): Promise<void> {
  await createNote(input);
  revalidateDashboard();
}

export async function updateNoteAction(
  id: string,
  input: { text?: string; icon?: string | null; pinned?: boolean },
): Promise<void> {
  await updateNote(id, input);
  revalidateDashboard();
}

export async function deleteNoteAction(id: string): Promise<void> {
  await deleteNote(id);
  revalidateDashboard();
}

export async function togglePinNoteAction(id: string): Promise<void> {
  await togglePinNote(id);
  revalidateDashboard();
}
```

(If Task 5 not done yet, temporarily `import { revalidatePath } from "next/cache"` and call `revalidatePath("/")`; replace when Task 5 lands.)

- [ ] **Step 6: Typecheck.** `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/data.ts web/src/lib/repositories/notes.ts web/src/lib/repositories/notes.test.ts web/src/app/actions/notes.ts
git commit -m "feat(notes): persistent notes CRUD repo + server actions"
```

---

## Task 5: Shared `revalidateDashboard()` covering `/mobile/*`

**Files:**
- Create: `web/src/lib/revalidate.ts`
- Modify: `web/src/app/actions/{tasks,meals,shopping,phase,accounts,notes}.ts`

**Interfaces:**
- Produces: `revalidateDashboard(): void` — revalidates `/` and every mobile route so both tablet and phone refresh after any mutation.

- [ ] **Step 1: Create the helper**

```ts
// web/src/lib/revalidate.ts
import { revalidatePath } from "next/cache";

const DASHBOARD_PATHS = [
  "/",
  "/mobile",
  "/mobile/tasks",
  "/mobile/meals",
  "/mobile/shopping",
  "/mobile/more",
] as const;

/**
 * Revalidates the tablet root and all mobile routes. Both surfaces share the
 * same data, so any mutation should refresh both. Cheap; runs server-side.
 */
export function revalidateDashboard(): void {
  for (const path of DASHBOARD_PATHS) revalidatePath(path);
}
```

- [ ] **Step 2: Replace `revalidatePath("/")` with `revalidateDashboard()`** in each action file. For each of `tasks.ts`, `meals.ts`, `shopping.ts`, `phase.ts`, `accounts.ts`, `notes.ts`:
  - remove the `import { revalidatePath } from "next/cache";` line **only if** no other `revalidatePath` call with a non-"/" argument remains,
  - add `import { revalidateDashboard } from "@/lib/revalidate";`,
  - swap every `revalidatePath("/")` → `revalidateDashboard()`.

  Note: `pushToBringAction` and `pushFreshBatchAction` in `meals.ts`/`shopping.ts` — keep their existing behavior; `pushToBringAction` has no revalidate today (leave as is), `pushFreshBatchAction` currently revalidates `/` → swap to `revalidateDashboard()`.

- [ ] **Step 3: Typecheck + lint.** `npx tsc --noEmit && npm run lint`. Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/revalidate.ts web/src/app/actions/
git commit -m "feat(actions): revalidate mobile routes too via shared revalidateDashboard()"
```

---

## Task 6: Re-skin the mobile layout shell + `PageHeader`

**Files:**
- Modify: `web/src/app/(mobile)/layout.tsx`
- Create: `web/src/components/mobile/PageHeader.tsx`

**Interfaces:**
- Produces: `<PageHeader eyebrow? title accentDot? right? />` — mobile page header in the `CardHead` visual language.

- [ ] **Step 1: Rewrite the layout shell** `web/src/app/(mobile)/layout.tsx`

```tsx
import { MobileNavBar } from "@/components/mobile/MobileNavBar";
import "../globals.css";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-cream text-ink dark:bg-[#1b1a18] dark:text-cream min-h-[100svh] flex flex-col pb-20 font-body">
        <main className="flex-1 overflow-y-auto p-4 rise">{children}</main>
        <MobileNavBar />
      </body>
    </html>
  );
}
```

(Dark mode: `prefers-color-scheme` drives it automatically via Tailwind's `dark` variant once the root has no forced `.dark` class — the tablet toggles `.dark` manually, but mobile relies on the media query. The `@custom-variant dark` in `globals.css` matches `.dark`; to honor the OS setting on mobile, add the media fallback in Step 2.)

- [ ] **Step 2: Add an OS-dark fallback** to `web/src/app/globals.css` (append at end) so mobile follows the system without a manual toggle:

```css
@media (prefers-color-scheme: dark) {
  html:not(.light) body {
    background: #1b1a18;
  }
}
```

Note: the existing `@custom-variant dark (&:where(.dark, .dark *))` only reacts to a `.dark` class. To make `dark:` utilities respond to the OS on mobile, change that line in `globals.css` to also match the media query:

```css
@custom-variant dark (&:where(.dark, .dark *), @media (prefers-color-scheme: dark));
```

Verify the tablet (`/`) still respects its manual toggle after this change (the manual `.dark` class still wins for `/`; the media query adds OS-driven dark where no class is set). If the tablet regresses, revert this line and instead gate mobile dark with an inline script that sets `.dark` from `matchMedia` in the mobile layout. Confirm visually in Step 4.

- [ ] **Step 3: Create `PageHeader`**

```tsx
// web/src/components/mobile/PageHeader.tsx
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  accentDot,
  right,
}: {
  eyebrow?: string;
  title: string;
  accentDot?: string; // e.g. "bg-dome" | "bg-emely"
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 mb-1">
            {accentDot && <span className={`w-2.5 h-2.5 rounded-full ${accentDot}`} />}
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="font-display font-semibold text-ink dark:text-cream leading-tight text-[26px]">
          {title}
        </h1>
      </div>
      {right}
    </div>
  );
}
```

- [ ] **Step 4: Verify.** `npx tsc --noEmit`. Then run the app (`npm run dev`) and load `/mobile/meals` — confirm cream background, no slate, header in brand style. Confirm `/` (tablet) dark toggle still works. *(User performs the visual check.)*

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(mobile)/layout.tsx" web/src/components/mobile/PageHeader.tsx web/src/app/globals.css
git commit -m "feat(mobile): re-skin shell to cream/ink design + OS dark + PageHeader"
```

---

## Task 7: 5-tab cream `MobileNavBar`

**Files:**
- Modify: `web/src/components/mobile/MobileNavBar.tsx`

**Interfaces:**
- Consumes: route paths `/mobile`, `/mobile/tasks`, `/mobile/meals`, `/mobile/shopping`, `/mobile/more`.

- [ ] **Step 1: Rewrite the nav** as a client component that highlights the active tab via `usePathname`.

```tsx
// web/src/components/mobile/MobileNavBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, CheckSquare, Utensils, ShoppingCart, Menu } from "lucide-react";

const TABS = [
  { href: "/mobile", label: "Heute", Icon: Sun, exact: true },
  { href: "/mobile/tasks", label: "Aufgaben", Icon: CheckSquare, exact: false },
  { href: "/mobile/meals", label: "Essen", Icon: Utensils, exact: false },
  { href: "/mobile/shopping", label: "Einkauf", Icon: ShoppingCart, exact: false },
  { href: "/mobile/more", label: "Mehr", Icon: Menu, exact: false },
] as const;

export function MobileNavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-cream-soft/95 dark:bg-[#26241F]/95 backdrop-blur border-t border-black/[0.06] dark:border-white/10 shadow-card flex justify-around py-2 pb-safe">
      {TABS.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${
              active ? "text-dome-deep dark:text-dome" : "text-ink-faint hover:text-ink-soft dark:hover:text-cream/70"
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
            <span className="text-[11px] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verify.** `npx tsc --noEmit`. User loads `/mobile/meals`, taps tabs — active tab tints teal, no slate.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/mobile/MobileNavBar.tsx
git commit -m "feat(mobile): 5-tab cream bottom nav with active-tab accent"
```

---

## Task 8: Heute page (`TodayView`)

**Files:**
- Create: `web/src/components/mobile/TodayView.tsx`
- Modify: `web/src/app/(mobile)/mobile/page.tsx` (replace the redirect)

**Interfaces:**
- Consumes: `getTasksByPerson`, `getTodaysEvents`, `getActivePhase`, `getComputedSplit`, `getCurrent`/`weather` fallback, `toggleTaskAction`/`deferTaskAction`/`failTaskAction`. Reuses `TaskTile`, `AppointmentsTile`, `Weather`, `PhaseSwitch`, `Card`.

- [ ] **Step 1: Build the page** `web/src/app/(mobile)/mobile/page.tsx` (server component) — load the same data the tablet's `/` loads for "today", pass to a client `TodayView` for the interactive task tiles.

```tsx
import { TodayView } from "@/components/mobile/TodayView";
import { weather as weatherFallback } from "@/lib/data";
import { getCurrent } from "@/integrations/weather/openMeteo";
import { getTasksByPerson } from "@/lib/repositories/tasks";
import { getTodaysEvents } from "@/lib/repositories/calendar";
import { getActivePhase } from "@/lib/repositories/phase";
import { getComputedSplit } from "@/lib/repositories/accounts";

export const dynamic = "force-dynamic";

export default async function MobileTodayPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [domeTasks, emelyTasks, appointments, phase, split] = await Promise.all([
    getTasksByPerson("dome", today),
    getTasksByPerson("emely", today),
    getTodaysEvents(today),
    getActivePhase(),
    getComputedSplit(),
  ]);

  let weather = weatherFallback;
  try {
    weather = await getCurrent();
  } catch {
    weather = weatherFallback;
  }

  return (
    <TodayView
      domeTasks={domeTasks}
      emelyTasks={emelyTasks}
      appointments={appointments}
      weather={weather}
      phase={phase}
      split={split}
    />
  );
}
```

- [ ] **Step 2: Build `TodayView`** (client) — mirrors the tablet hero band stacked vertically, with the same optimistic task handling as `dashboard.tsx`.

```tsx
// web/src/components/mobile/TodayView.tsx
"use client";

import { useOptimistic, startTransition } from "react";
import type { Task, Appointment } from "@/lib/data";
import type { CurrentWeather } from "@/integrations/weather/openMeteo";
import type { ActivePhase } from "@/lib/repositories/phase";
import { toggleTaskAction, deferTaskAction, failTaskAction } from "@/app/actions/tasks";
import { TaskTile, AppointmentsTile } from "@/components/tiles";
import { Weather } from "@/components/Weather";
import { PhaseSwitch } from "@/components/PhaseSwitch";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";
import { PERSON } from "@/lib/data";

type Opt = { id: string; type: "toggle" | "defer" | "fail" };

export function TodayView({
  domeTasks,
  emelyTasks,
  appointments,
  weather,
  phase,
  split,
}: {
  domeTasks: Task[];
  emelyTasks: Task[];
  appointments: Appointment[];
  weather: CurrentWeather;
  phase: ActivePhase | null;
  split: { dome: number; emely: number };
}) {
  const [tasks, applyOpt] = useOptimistic(
    [...domeTasks, ...emelyTasks],
    (state: Task[], { id, type }: Opt) =>
      state.map((t) => {
        if (t.id !== id) return t;
        if (type === "toggle") return { ...t, status: t.status === "open" ? "done" : "open" };
        if (type === "defer") return { ...t, status: "moved" };
        return { ...t, status: "failed" };
      }),
  );

  const run = (id: string, type: Opt["type"], action: (id: string) => Promise<void>) =>
    startTransition(async () => {
      applyOpt({ id, type });
      await action(id);
    });

  const onToggle = (id: string) => run(id, "toggle", toggleTaskAction);
  const onDefer = (id: string) => run(id, "defer", deferTaskAction);
  const onFail = (id: string) => run(id, "fail", failTaskAction);

  const dome = tasks.filter((t) => t.person === "dome");
  const emely = tasks.filter((t) => t.person === "emely");

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Heute im Fokus" title="Heute" />

      <Weather weather={weather} />

      <TaskTile person="dome" tasks={dome} onToggle={onToggle} onDefer={onDefer} onFail={onFail} />
      <TaskTile person="emely" tasks={emely} onToggle={onToggle} onDefer={onDefer} onFail={onFail} />

      <AppointmentsTile appointments={appointments} />

      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
            {phase?.mode === "elternzeit" ? "Elternzeit-Modus" : "Aufteilung diese Woche"}
          </span>
          <PhaseSwitch phase={phase} />
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-cream dark:bg-white/10">
          <div className={`${PERSON.dome.fill} h-full`} style={{ width: `${split.dome}%` }} />
          <div className={`${PERSON.emely.fill} h-full`} style={{ width: `${split.emely}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[12px] font-semibold">
          <span className={PERSON.dome.text}>Dome {split.dome}%</span>
          <span className={PERSON.emely.text}>Emely {split.emely}%</span>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify.** `npx tsc --noEmit`. User loads `/mobile`, confirms weather + both task tiles (tappable, optimistic), appointments, split bar render in brand style; long-press a task opens the action menu (defer/fail).

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(mobile)/mobile/page.tsx" web/src/components/mobile/TodayView.tsx
git commit -m "feat(mobile): Heute landing page (weather, tasks, appointments, split)"
```

---

## Task 9: Aufgaben page (`TasksView`) — list, quick-add, complete-existing picker, defer

**Files:**
- Create: `web/src/components/mobile/TasksView.tsx`
- Modify: `web/src/app/(mobile)/mobile/tasks/page.tsx`

**Interfaces:**
- Consumes: `getTasksForDay`, `listOpenTasks` (Task 3), `toggleTaskAction`/`deferTaskAction`/`failTaskAction`, `addTaskAction` (Task 3). Reuses `TaskRow`, `Card`, `PersonBadge`, `PageHeader`.

- [ ] **Step 1: Build the page** `web/src/app/(mobile)/mobile/tasks/page.tsx`

```tsx
import { TasksView } from "@/components/mobile/TasksView";
import { getTasksForDay, listOpenTasks } from "@/lib/repositories/tasks";

export const dynamic = "force-dynamic";

export default async function MobileTasksPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayTasks, allOpen] = await Promise.all([getTasksForDay(today), listOpenTasks()]);
  return <TasksView todayTasks={todayTasks} allOpen={allOpen} />;
}
```

- [ ] **Step 2: Build `TasksView`** (client). Three blocks: today's open/done list (optimistic toggle/defer/fail), a quick-add form, and a "Erledigt nachtragen" picker over `allOpen` (not-due tasks) that completes a real task via `toggleTaskAction` (this is what triggers the recurrence restart + EWMA from Task 2).

```tsx
// web/src/components/mobile/TasksView.tsx
"use client";

import { useState, useOptimistic, startTransition } from "react";
import type { Task } from "@/lib/data";
import type { OpenTaskDTO } from "@/lib/repositories/tasks";
import { toggleTaskAction, deferTaskAction, failTaskAction, addTaskAction } from "@/app/actions/tasks";
import { TaskRow } from "@/components/tiles";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";

type Opt = { id: string; type: "toggle" | "defer" | "fail" };

export function TasksView({ todayTasks, allOpen }: { todayTasks: Task[]; allOpen: OpenTaskDTO[] }) {
  const [tasks, applyOpt] = useOptimistic(todayTasks, (state: Task[], { id, type }: Opt) =>
    state.map((t) => {
      if (t.id !== id) return t;
      if (type === "toggle") return { ...t, status: t.status === "open" ? "done" : "open" };
      if (type === "defer") return { ...t, status: "moved" };
      return { ...t, status: "failed" };
    }),
  );

  const run = (id: string, type: Opt["type"], action: (id: string) => Promise<void>) =>
    startTransition(async () => {
      applyOpt({ id, type });
      await action(id);
    });

  const [addOpen, setAddOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Steuerung"
        title="Aufgaben"
        right={
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            aria-label="Neue Aufgabe"
            className="shrink-0 w-10 h-10 grid place-items-center rounded-full bg-ink text-cream dark:bg-cream dark:text-ink text-[22px] leading-none shadow-card"
          >
            +
          </button>
        }
      />

      {addOpen && <QuickAddForm onDone={() => setAddOpen(false)} />}

      <Card>
        <ul className="-my-1">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={(id) => run(id, "toggle", toggleTaskAction)}
              onDefer={(id) => run(id, "defer", deferTaskAction)}
              onFail={(id) => run(id, "fail", failTaskAction)}
            />
          ))}
          {tasks.length === 0 && <li className="py-6 text-center text-ink-faint text-[14px]">Heute nichts offen.</li>}
        </ul>
      </Card>

      <button
        type="button"
        onClick={() => setPickOpen((v) => !v)}
        className="w-full text-[13px] font-semibold text-ink-soft dark:text-cream/70 bg-white dark:bg-[#26241F] rounded-xl2 shadow-card py-3"
      >
        Erledigt nachtragen — Aufgabe wählen
      </button>

      {pickOpen && <CompleteExistingPicker tasks={allOpen} onPicked={() => setPickOpen(false)} />}
    </div>
  );
}

function QuickAddForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState("15");
  const [who, setWho] = useState<"both" | "dome" | "emely">("both");
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const eff = Number(effort);
    if (!t || !Number.isFinite(eff) || eff <= 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setPending(true);
    startTransition(async () => {
      await addTaskAction({
        title: t,
        effort: Math.round(eff),
        allowedPersons: who,
        dueDateISO: today.toISOString(),
        assignToKey: who === "both" ? null : who,
      });
      setTitle("");
      setEffort("15");
      setPending(false);
      onDone();
    });
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Was ist zu tun?"
          autoFocus
          className="w-full text-[15px] bg-cream/60 dark:bg-white/[0.05] rounded-xl px-3 py-2.5 outline-none text-ink dark:text-cream/90 placeholder:text-ink-faint"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="w-20 text-[14px] bg-cream/60 dark:bg-white/[0.05] rounded-xl px-3 py-2 outline-none tabular-nums text-ink dark:text-cream/90"
          />
          <span className="text-[13px] text-ink-faint">Min</span>
          <div className="ml-auto flex gap-1.5">
            {(["both", "dome", "emely"] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWho(w)}
                className={`px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors ${
                  who === w ? "bg-ink text-cream dark:bg-cream dark:text-ink" : "bg-cream/70 dark:bg-white/[0.05] text-ink-soft"
                }`}
              >
                {w === "both" ? "Beide" : w === "dome" ? "Dome" : "Emely"}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="w-full py-2.5 rounded-xl bg-dome text-white font-semibold text-[14px] disabled:opacity-40"
        >
          Aufgabe anlegen
        </button>
      </form>
    </Card>
  );
}

function CompleteExistingPicker({ tasks, onPicked }: { tasks: OpenTaskDTO[]; onPicked: () => void }) {
  const complete = (id: string) =>
    startTransition(async () => {
      await toggleTaskAction(id); // open -> done; triggers recurrence restart + EWMA
      onPicked();
    });

  return (
    <Card>
      <p className="text-[12.5px] text-ink-soft dark:text-cream/60 mb-3">
        Aufgabe als erledigt markieren — startet das Intervall neu und passt es an.
      </p>
      <ul className="divide-y divide-black/5 dark:divide-white/5">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <span className="text-[15px]">{t.icon || "•"}</span>
            <span className="flex-1 min-w-0 text-[14px] text-ink dark:text-cream/90 truncate">{t.title}</span>
            {t.rhythm && <span className="text-[11px] text-ink-faint">{t.rhythm}</span>}
            <button
              type="button"
              onClick={() => complete(t.id)}
              className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-dome-soft text-dome-deep dark:bg-dome/20 dark:text-dome"
            >
              Erledigt ✓
            </button>
          </li>
        ))}
        {tasks.length === 0 && <li className="py-4 text-center text-ink-faint text-[13px]">Keine offenen Aufgaben.</li>}
      </ul>
    </Card>
  );
}
```

- [ ] **Step 3: Verify.** `npx tsc --noEmit`. User loads `/mobile/tasks`: today's list toggles optimistically; "+" opens quick-add and a new task appears after submit; "Erledigt nachtragen" lists open tasks and completing a routine there spawns its next occurrence with a restarted due date. *(User confirms recurrence behavior against Task 2 tests run manually.)*

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(mobile)/mobile/tasks/page.tsx" web/src/components/mobile/TasksView.tsx
git commit -m "feat(mobile): tasks page — list, quick-add, complete-existing (interval restart), defer"
```

---

## Task 10: Einkauf page (`ShoppingView`)

**Files:**
- Create: `web/src/components/mobile/ShoppingView.tsx`
- Create: `web/src/app/(mobile)/mobile/shopping/page.tsx`

**Interfaces:**
- Consumes: `getShoppingItems`, `getFreshShoppingState`, `toggleShoppingAction`, `toggleFreshnessAction`. Reuses `BringSyncControl`, `FreshShoppingControl`, `Card`, `PageHeader`.

- [ ] **Step 1: Build the page** `web/src/app/(mobile)/mobile/shopping/page.tsx`

```tsx
import { ShoppingView } from "@/components/mobile/ShoppingView";
import { getShoppingItems, getFreshShoppingState } from "@/lib/repositories/shopping";

export const dynamic = "force-dynamic";

export default async function MobileShoppingPage() {
  const [items, fresh] = await Promise.all([getShoppingItems(), getFreshShoppingState()]);
  return <ShoppingView items={items} fresh={fresh} />;
}
```

- [ ] **Step 2: Build `ShoppingView`** (client) — checkable list with optimistic toggle, freshness correction on recipe items, plus the reused Bring + fresh-batch controls.

```tsx
// web/src/components/mobile/ShoppingView.tsx
"use client";

import { useOptimistic, startTransition } from "react";
import type { ShoppingItem, FreshShoppingState } from "@/lib/data";
import { toggleShoppingAction, toggleFreshnessAction } from "@/app/actions/shopping";
import { BringSyncControl } from "@/components/BringSyncControl";
import { FreshShoppingControl } from "@/components/FreshShoppingControl";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";

export function ShoppingView({ items, fresh }: { items: ShoppingItem[]; fresh: FreshShoppingState }) {
  const [list, toggleOpt] = useOptimistic(items, (state: ShoppingItem[], id: string) =>
    state.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
  );

  const toggle = (id: string) =>
    startTransition(async () => {
      toggleOpt(id);
      await toggleShoppingAction(id);
    });

  const flipFresh = (id: string) => startTransition(() => toggleFreshnessAction(id));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Steuerung" title="Einkauf" right={<BringSyncControl items={list} />} />

      <FreshShoppingControl fresh={fresh} />

      <Card>
        <ul className="-my-0.5">
          {list.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => toggle(i.id)}
                aria-label={i.done ? "Wieder offen" : "Erledigt"}
                className={`shrink-0 w-6 h-6 rounded-full grid place-items-center border-2 transition-all ${
                  i.done ? "bg-dome border-transparent text-white" : "border-ink-faint/40 text-transparent"
                }`}
              >
                ✓
              </button>
              <span
                className={`flex-1 min-w-0 text-[15px] ${
                  i.done ? "line-through text-ink-faint" : "text-ink dark:text-cream/90"
                }`}
              >
                {i.meal && <span className="mr-1.5">🍽️</span>}
                {i.text}
              </span>
              {i.category && (
                <button
                  type="button"
                  onClick={() => flipFresh(i.id)}
                  className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cream/70 dark:bg-white/[0.05] text-ink-soft"
                >
                  {i.category === "frisch" ? "frisch" : "haltbar"}
                </button>
              )}
            </li>
          ))}
          {list.length === 0 && <li className="py-6 text-center text-ink-faint text-[14px]">Liste ist leer.</li>}
        </ul>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify.** `npx tsc --noEmit`. User loads `/mobile/shopping`: items toggle optimistically; recipe items show frisch/haltbar toggle; "An Bring senden" + fresh-batch controls work.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(mobile)/mobile/shopping/page.tsx" web/src/components/mobile/ShoppingView.tsx
git commit -m "feat(mobile): shopping page — checklist, freshness correction, Bring push"
```

---

## Task 11: Mehr page (`MoreView` + `NotesEditor`)

**Files:**
- Create: `web/src/components/mobile/NotesEditor.tsx`
- Create: `web/src/components/mobile/MoreView.tsx`
- Create: `web/src/app/(mobile)/mobile/more/page.tsx`
- Delete: `web/src/app/(mobile)/mobile/notes/page.tsx`, `web/src/app/(mobile)/mobile/settings/page.tsx`

**Interfaces:**
- Consumes: `getNotes` (with `pinned`), note CRUD actions (Task 4), `getActivePhase`, `PhaseSwitch`, `PushSetupControl`. Reuses `Card`, `PageHeader`.

- [ ] **Step 1: Build `NotesEditor`** (client) — list with pin/edit/delete and an add field.

```tsx
// web/src/components/mobile/NotesEditor.tsx
"use client";

import { useState, startTransition } from "react";
import type { Note } from "@/lib/data";
import { createNoteAction, updateNoteAction, deleteNoteAction, togglePinNoteAction } from "@/app/actions/notes";
import { Card } from "@/components/ui";

export function NotesEditor({ notes }: { notes: Note[] }) {
  const [draft, setDraft] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      await createNoteAction({ text });
      setDraft("");
    });
  };

  return (
    <Card>
      <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint mb-3">Notizen</h2>

      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Neue Notiz …"
          className="flex-1 min-w-0 text-[14px] bg-cream/60 dark:bg-white/[0.05] rounded-xl px-3 py-2 outline-none text-ink dark:text-cream/90 placeholder:text-ink-faint"
        />
        <button type="submit" disabled={!draft.trim()} className="px-3 rounded-xl bg-ink text-cream dark:bg-cream dark:text-ink font-semibold text-[18px] disabled:opacity-40">
          +
        </button>
      </form>

      <ul className="space-y-2">
        {notes.map((n) => (
          <NoteItem key={n.id} note={n} />
        ))}
        {notes.length === 0 && <li className="py-3 text-center text-ink-faint text-[13px]">Noch keine Notizen.</li>}
      </ul>
    </Card>
  );
}

function NoteItem({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);

  const save = () => {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await updateNoteAction(note.id, { text: t });
      setEditing(false);
    });
  };

  return (
    <li className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-500/[0.07] ring-1 ring-amber-200/50 dark:ring-amber-500/10">
      <button
        type="button"
        onClick={() => startTransition(() => togglePinNoteAction(note.id))}
        aria-label="Anpinnen"
        className={`shrink-0 text-[14px] ${note.pinned ? "opacity-100" : "opacity-30"}`}
      >
        📌
      </button>
      {editing ? (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          autoFocus
          className="flex-1 min-w-0 text-[14px] bg-white/70 dark:bg-white/[0.06] rounded-lg px-2 py-1 outline-none text-ink dark:text-cream/90"
        />
      ) : (
        <span onClick={() => setEditing(true)} className="flex-1 min-w-0 text-[14px] text-ink dark:text-cream/85 leading-snug">
          {note.text}
        </span>
      )}
      <button
        type="button"
        onClick={() => startTransition(() => deleteNoteAction(note.id))}
        aria-label="Löschen"
        className="shrink-0 text-ink-faint hover:text-rose-500 text-[14px]"
      >
        ✕
      </button>
    </li>
  );
}
```

- [ ] **Step 2: Build `MoreView`** (server) and the page.

`web/src/components/mobile/MoreView.tsx`:

```tsx
import type { Note } from "@/lib/data";
import type { ActivePhase } from "@/lib/repositories/phase";
import { NotesEditor } from "@/components/mobile/NotesEditor";
import { PhaseSwitch } from "@/components/PhaseSwitch";
import { PushSetupControl } from "@/components/PushSetupControl";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/mobile/PageHeader";

export function MoreView({ notes, phase }: { notes: Note[]; phase: ActivePhase | null }) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Verwalten" title="Mehr" />

      <NotesEditor notes={notes} />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
            Elternzeit-Modus
          </span>
          <PhaseSwitch phase={phase} />
        </div>
      </Card>

      <Card>
        <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint mb-2">
          Push auf diesem Handy
        </h2>
        <p className="text-[12.5px] text-ink-soft dark:text-cream/60 mb-3">
          Aktivieren, um benachrichtigt zu werden, sobald ein Essensplan-Entwurf bereitliegt.
        </p>
        <PushSetupControl />
      </Card>
    </div>
  );
}
```

`web/src/app/(mobile)/mobile/more/page.tsx`:

```tsx
import { MoreView } from "@/components/mobile/MoreView";
import { getNotes } from "@/lib/repositories/notes";
import { getActivePhase } from "@/lib/repositories/phase";

export const dynamic = "force-dynamic";

export default async function MobileMorePage() {
  const [notes, phase] = await Promise.all([getNotes(), getActivePhase()]);
  return <MoreView notes={notes} phase={phase} />;
}
```

- [ ] **Step 3: Delete the obsolete routes.**

```bash
git rm "web/src/app/(mobile)/mobile/notes/page.tsx" "web/src/app/(mobile)/mobile/settings/page.tsx"
```

- [ ] **Step 4: Verify.** `npx tsc --noEmit`. User loads `/mobile/more`: add/edit/pin/delete notes work and persist across reload; phase switch toggles Elternzeit; push enable works.

- [ ] **Step 5: Commit**

```bash
git add "web/src/app/(mobile)/mobile/more/page.tsx" web/src/components/mobile/MoreView.tsx web/src/components/mobile/NotesEditor.tsx
git commit -m "feat(mobile): Mehr page — notes CRUD, Elternzeit-Modus, push setup"
```

---

## Task 12: Re-skin the Essen page header + final sweep

**Files:**
- Modify: `web/src/app/(mobile)/mobile/meals/page.tsx`

- [ ] **Step 1: Swap the bare `<h1>` for `PageHeader`** in the meals page (keep the existing `MealDraftPanel` data loading untouched).

```tsx
import { MealDraftPanel } from "@/components/MealDraftPanel";
import { getDraftMealPlan, listRecipes } from "@/lib/repositories/meals";
import { PageHeader } from "@/components/mobile/PageHeader";

export const dynamic = "force-dynamic";

export default async function MobileMealsPage() {
  const [draft, recipes] = await Promise.all([getDraftMealPlan(), listRecipes()]);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Steuerung" title="Essensplan" />
      {draft && draft.length > 0 ? (
        <MealDraftPanel draft={draft} recipes={recipes} />
      ) : (
        <p className="text-ink-soft dark:text-cream/60 text-[14px]">Aktuell liegt kein Entwurf für diese Woche vor.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Full verification.** Run `npx tsc --noEmit && npm run lint && npm run build`. Expected: all pass. User then walks all five tabs in the browser/PWA, confirms: consistent cream/ink theme, no slate remnants, every control mutates and both phone + tablet refresh.

- [ ] **Step 3: Commit**

```bash
git add "web/src/app/(mobile)/mobile/meals/page.tsx"
git commit -m "feat(mobile): re-skin meals page header to brand PageHeader"
```

---

## Self-Review

**Spec coverage:**
- Re-skin to design concept → Tasks 6, 7, 8–12 (Card/CardHead/PageHeader, cream shell, OS dark). ✓
- 5-tab nav Heute·Aufgaben·Essen·Einkauf·Mehr → Task 7 + pages in 8–12. ✓
- Quick-add tasks → Task 3 (backend) + Task 9 (UI). ✓
- Complete existing not-due task → interval restart + learning → Tasks 1, 2 (backend) + Task 9 picker. ✓
- Defer existing task → reuses `deferTaskAction`, surfaced in Tasks 8 & 9. ✓
- Persistent notes CRUD → Task 4 (backend) + Task 11 (UI). ✓
- Shopping control (toggle, freshness, Bring) → Task 10. ✓
- Elternzeit-Modus + push setup on phone → Tasks 8 & 11. ✓
- Both surfaces refresh on mutation → Task 5 (`revalidateDashboard`). ✓
- Smarter shopping list (merge duplicates, exclude pantry staples) → explicitly **out of scope** in the spec; **no task** (intentional). ✓

**Placeholder scan:** No "TBD"/"implement later". Each code step shows full code. Verification steps name exact commands.

**Type consistency:** `CreateTaskInput`/`OpenTaskDTO` defined in Task 3 and consumed by name in Tasks 3 & 9. `AddTaskInput.dueDateISO` (string) → `createTask.dueDate` (Date) conversion is explicit. `learnedInterval(number[]): number|null` defined in Task 1, consumed in Task 2. `revalidateDashboard()` defined in Task 5, consumed in Tasks 3, 4 (with a documented temporary fallback if Task 5 lands later). Note `pinned?` added to type in Task 4 before UI use in Task 11.

**Ordering note:** Task 5 (`revalidateDashboard`) is referenced by Tasks 3 & 4. Execute Task 5 before or immediately after 3/4; each notes the temporary `revalidatePath("/")` fallback to stay self-contained if run out of order.
