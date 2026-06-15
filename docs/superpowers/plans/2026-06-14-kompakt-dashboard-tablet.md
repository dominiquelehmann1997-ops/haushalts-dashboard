# Kompakt-Dashboard fürs Tablet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Dashboard passt im Querformat auf eine Tablet-Screen ohne Scrollen; einziger Schreibpfad ist die Aufgaben-Interaktion (Tippen/Halten/Nachtragen), alles andere ist Anzeige.

**Architecture:** Viewport-fixes CSS-Grid (`100dvh`, `overflow:hidden`, 3 Höhenzonen, Kacheln scrollen intern). Reines Wetter-Widget ersetzt die Baby-Kachel. Aufgaben bekommen ein Long-Press-Menü (Erledigt/Aufschieben/Geht nicht) + „+"-Nachtragen pro Person. „Aufschieben" verschiebt `dueDate` deterministisch auf den nächsten Rhythmus-Tag.

**Tech Stack:** Next.js 16 (App Router, React Server + Client Components), Prisma (better-sqlite3 Adapter), Vitest, Tailwind. Tests: `npx vitest run <pfad>`. Tablet-Build: `npx next build --webpack`.

**Spec:** `docs/superpowers/specs/2026-06-14-kompakt-dashboard-tablet-design.md`

---

## File Structure

- `web/src/integrations/weather/openMeteo.ts` — `wind` zur API-Abfrage + `CurrentWeather` + `mapCurrent`.
- `web/src/integrations/weather/fixture.ts` — Fixture um `wind_speed_10m` ergänzen.
- `web/src/integrations/weather/openMeteo.test.ts` — Test für `wind`-Mapping.
- `web/src/components/Weather.tsx` — **neu**, reines Wetter-Widget (ersetzt `WeatherBabyTile` im Dashboard).
- `web/src/lib/services/taskDefer.ts` — **neu**, pure `nextSensibleDay`.
- `web/src/lib/services/taskDefer.test.ts` — **neu**.
- `web/src/lib/repositories/tasks.ts` — `deferTask(id, today)` Repo-Funktion (setzt `moved` + neues `dueDate`).
- `web/src/lib/repositories/tasks.test.ts` — Test für `deferTask` (oder bestehende Datei).
- `web/src/app/actions/tasks.ts` — `deferTaskAction` ruft neue `deferTask`; neue `addTaskDoneAction` fürs Nachtragen.
- `web/src/components/TaskActionMenu.tsx` — **neu**, Long-Press-Popover.
- `web/src/components/tiles.tsx` — `TaskRow` Long-Press, `TaskTile` „+"-Header.
- `web/src/components/AddDoneInline.tsx` — **neu**, kompaktes Nachtragen-Formular pro Person (Logik aus `AddDoneEntry`).
- `web/src/components/TopbarStats.tsx` — **neu**, Kennzahl-Chips (offene Aufgaben, Projekt %).
- `web/src/components/widgets.tsx` — `MealPlanWidget` ohne `MealPlanControl`.
- `web/src/components/dashboard.tsx` — neuer Viewport-Grid-Shell, nur genutzte Props.
- `web/src/app/page.tsx` — entfernte Props nicht mehr laden/übergeben.

---

## Task 1: Wind in die Wetter-Daten

**Files:**
- Modify: `web/src/integrations/weather/openMeteo.ts`
- Modify: `web/src/integrations/weather/fixture.ts`
- Test: `web/src/integrations/weather/openMeteo.test.ts`

- [ ] **Step 1: Fixture um Windfeld ergänzen**

In `web/src/integrations/weather/fixture.ts` im `current`-Objekt das Feld ergänzen (neben `temperature_2m`/`weather_code`/`uv_index`):

```ts
    wind_speed_10m: 12,
```

- [ ] **Step 2: Failing test schreiben**

In `web/src/integrations/weather/openMeteo.test.ts` einen Test ergänzen (Fixture-Import existiert dort bereits):

```ts
it("mapCurrent liest die Windgeschwindigkeit aus current", () => {
  const result = mapCurrent(fixture);
  expect(result.wind).toBe(12);
});
```

- [ ] **Step 3: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/integrations/weather/openMeteo.test.ts`
Expected: FAIL — `result.wind` ist `undefined` / Typ `wind` existiert nicht.

- [ ] **Step 4: Typ + Response + Mapping + URL erweitern**

In `openMeteo.ts`:

`OpenMeteoResponse.current` erweitern:

```ts
  current?: {
    time: string;
    temperature_2m: number;
    weather_code: number;
    uv_index?: number;
    wind_speed_10m?: number;
  };
```

`CurrentWeather` erweitern:

```ts
export interface CurrentWeather {
  temp: number;
  label: string;
  detail: string;
  hi: number;
  lo: number;
  rainFrom: string;
  uvIndex: number;
  wind: number;
}
```

In `mapCurrent` vor dem `return` berechnen und im Objekt ergänzen:

```ts
  const wind = Math.round(current?.wind_speed_10m ?? 0);
```

```ts
  return {
    temp: current ? Math.round(current.temperature_2m) : Math.round(raw.daily.temperature_2m_max[dailyIndex]),
    label,
    detail,
    hi: Math.round(raw.daily.temperature_2m_max[dailyIndex]),
    lo: Math.round(raw.daily.temperature_2m_min[dailyIndex]),
    rainFrom,
    uvIndex,
    wind,
  };
```

In `buildUrl` den `current`-Parameter erweitern:

```ts
    current: "temperature_2m,weather_code,uv_index,wind_speed_10m",
```

- [ ] **Step 5: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/integrations/weather/openMeteo.test.ts`
Expected: PASS.

- [ ] **Step 6: Fallback-Wetter ergänzen (Typprüfung grün halten)**

`web/src/lib/data.ts` exportiert ein `weather`-Fallback-Objekt vom Typ `CurrentWeather`. `wind`-Feld ergänzen (Wert passend zum Demo, z.B. `wind: 10`). Falls weitere Stellen `CurrentWeather`-Literale bauen: Typcheck zeigt sie.

Run: `npx vitest run` und `npm run typecheck`
Expected: beide grün.

- [ ] **Step 7: Commit**

```bash
git add web/src/integrations/weather/openMeteo.ts web/src/integrations/weather/fixture.ts web/src/integrations/weather/openMeteo.test.ts web/src/lib/data.ts
git commit -m "feat(weather): expose wind speed in current weather"
```

---

## Task 2: Reines Wetter-Widget `Weather`

**Files:**
- Create: `web/src/components/Weather.tsx`

Ersetzt `WeatherBabyTile` im Dashboard (Task 7). Kein Baby-Inhalt. Nutzt `Card`/`CardHead` aus `@/components/ui` und `CloudRainGlyph` aus `@/components/icons` (wie `WeatherBabyTile`).

- [ ] **Step 1: Komponente schreiben**

```tsx
import { Card, CardHead } from "@/components/ui";
import { CloudRainGlyph } from "@/components/icons";
import type { CurrentWeather } from "@/integrations/weather/openMeteo";

export function Weather({ weather }: { weather: CurrentWeather }) {
  return (
    <Card className="relative overflow-hidden h-full">
      <CardHead eyebrow="Wetter · Heute" title={weather.label} />
      <div className="flex items-end gap-3">
        <span className="text-[44px] leading-none font-display font-semibold text-ink dark:text-cream tracking-tight">
          {weather.temp}°
        </span>
        <CloudRainGlyph />
        <span className="ml-auto text-[13px] text-ink-soft dark:text-cream/55 tabular-nums">
          {weather.hi}° / {weather.lo}°
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[12.5px] font-medium">
        {weather.rainFrom && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            ☔ {weather.detail}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream text-ink-soft dark:bg-white/5 dark:text-cream/60">
          💨 {weather.wind} km/h
        </span>
        {weather.uvIndex >= 3 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            ☀️ UV {weather.uvIndex}
          </span>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (Komponente noch ungenutzt — ok; in Task 7 eingebunden).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Weather.tsx
git commit -m "feat(dashboard): add baby-free Weather widget"
```

---

## Task 3: „Aufschieben"-Logik (nächster sinnvoller Tag) + `deferTask`

**Files:**
- Create: `web/src/lib/services/taskDefer.ts`
- Create: `web/src/lib/services/taskDefer.test.ts`
- Modify: `web/src/lib/repositories/tasks.ts`
- Modify: `web/src/app/actions/tasks.ts`

`nextSensibleDay`: bei vorhandenem `rhythm` → `nextDueDate(rhythm, today)` (aus `@/lib/services/recurrence`); sonst Fallback `today + 1 Tag`.

- [ ] **Step 1: Failing test schreiben**

`web/src/lib/services/taskDefer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextSensibleDay } from "./taskDefer";

describe("nextSensibleDay", () => {
  it("nutzt den Rhythmus, wenn vorhanden (weekly = +7 Tage)", () => {
    const today = new Date("2026-06-14T00:00:00");
    const result = nextSensibleDay({ rhythm: "weekly" }, today);
    expect(result.toISOString().slice(0, 10)).toBe("2026-06-21");
  });

  it("fällt ohne Rhythmus auf morgen zurück", () => {
    const today = new Date("2026-06-14T00:00:00");
    const result = nextSensibleDay({ rhythm: null }, today);
    expect(result.toISOString().slice(0, 10)).toBe("2026-06-15");
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/services/taskDefer.test.ts`
Expected: FAIL — Modul/Funktion existiert nicht.

- [ ] **Step 3: Implementieren**

`web/src/lib/services/taskDefer.ts`:

```ts
import { nextDueDate } from "@/lib/services/recurrence";

/**
 * Nächster sinnvoller Fälligkeitstag beim manuellen Aufschieben:
 * - mit Rhythmus → nächster Rhythmus-Tag (recurrence.nextDueDate)
 * - ohne Rhythmus (Einmal-/Einkaufsaufgabe) → morgen
 * `from` wird nicht mutiert.
 */
export function nextSensibleDay(task: { rhythm: string | null }, from: Date): Date {
  if (task.rhythm) {
    return nextDueDate(task.rhythm, from);
  }
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  return next;
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/lib/services/taskDefer.test.ts`
Expected: PASS.

- [ ] **Step 5: `deferTask` Repo-Funktion — failing test**

In `web/src/lib/repositories/tasks.test.ts` (Datei existiert; nutzt In-Memory-Prisma-Client wie die anderen Repo-Tests — Muster aus `planning.test.ts` übernehmen, das einen `client` injiziert). Test:

```ts
it("deferTask setzt Status moved und schiebt dueDate auf den nächsten Rhythmus-Tag", async () => {
  // Arrange: eine offene, zugewiesene weekly-Aufgabe fällig heute anlegen
  const today = new Date("2026-06-14T00:00:00");
  const person = await client.person.create({ data: { key: "dome", name: "Dome" } });
  const task = await client.task.create({
    data: {
      title: "Bad putzen (klein)", type: "routine", effort: 15, rhythm: "weekly",
      allowedPersons: "both", status: "open", dueDate: today, assignedToId: person.id,
    },
  });

  // Act
  await deferTask(task.id, today, client);

  // Assert
  const after = await client.task.findUniqueOrThrow({ where: { id: task.id } });
  expect(after.status).toBe("moved");
  expect(after.dueDate.toISOString().slice(0, 10)).toBe("2026-06-21");
});
```

(Falls `tasks.test.ts` noch nicht existiert: neu anlegen, Setup für den injizierten `client` aus `planning.test.ts` kopieren — gleicher better-sqlite3-Memory-Client + `migrate`.)

- [ ] **Step 6: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/repositories/tasks.test.ts`
Expected: FAIL — `deferTask` existiert nicht.

- [ ] **Step 7: `deferTask` implementieren**

In `web/src/lib/repositories/tasks.ts` ergänzen (Imports oben: `nextSensibleDay`):

```ts
import { nextSensibleDay } from "@/lib/services/taskDefer";
```

```ts
/**
 * Schiebt eine Aufgabe auf den nächsten sinnvollen Tag (Rhythmus, sonst morgen)
 * und markiert sie als `moved`. `reason` dokumentiert die Verschiebung in der UI.
 */
export async function deferTask(
  id: string,
  today: Date,
  client: PrismaClient = prisma,
): Promise<void> {
  const task = await client.task.findUniqueOrThrow({ where: { id } });
  const nextDay = nextSensibleDay({ rhythm: task.rhythm }, today);
  await client.task.update({
    where: { id },
    data: {
      status: "moved",
      dueDate: nextDay,
      note: `auf ${nextDay.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })} verschoben`,
    },
  });
}
```

- [ ] **Step 8: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/lib/repositories/tasks.test.ts`
Expected: PASS.

- [ ] **Step 9: `deferTaskAction` umstellen**

In `web/src/app/actions/tasks.ts` die bestehende `deferTaskAction` ersetzen, sodass sie tatsächlich verschiebt (heute serverseitig bestimmt):

```ts
import { setTaskStatus, deferTask } from "@/lib/repositories/tasks";
```

```ts
/** Schiebt eine Aufgabe auf den nächsten sinnvollen Tag (Status "moved"). */
export async function deferTaskAction(id: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await deferTask(id, today);
  revalidatePath("/");
}
```

(Die bisherige Signatur `deferTaskAction(id, reason)` entfällt; aktuell ruft sie niemand produktiv auf — Typecheck bestätigt.)

- [ ] **Step 10: Typecheck + Volltest**

Run: `npm run typecheck && npx vitest run`
Expected: beide grün.

- [ ] **Step 11: Commit**

```bash
git add web/src/lib/services/taskDefer.ts web/src/lib/services/taskDefer.test.ts web/src/lib/repositories/tasks.ts web/src/lib/repositories/tasks.test.ts web/src/app/actions/tasks.ts
git commit -m "feat(tasks): defer to next sensible day (rhythm-aware)"
```

---

## Task 4: Nachtragen pro Person — `addTaskDoneAction` + `AddDoneInline`

**Files:**
- Modify: `web/src/app/actions/tasks.ts`
- Create: `web/src/components/AddDoneInline.tsx`

Wiederverwendet die bestehende `addManualEntryAction` (aus `@/app/actions/accounts`), die `AddDoneEntry` schon nutzt. `AddDoneInline` ist die kompakte, personen-vorbelegte Variante fürs „+" im Kachel-Header.

- [ ] **Step 1: `AddDoneInline` schreiben**

```tsx
"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addManualEntryAction } from "@/app/actions/accounts";

/** Kompaktes "Erledigt nachtragen" für eine feste Person (Kachel-Header "+"). */
export function AddDoneInline({ person }: { person: "dome" | "emely" }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    const parsed = Number(points);
    if (!trimmed || !Number.isFinite(parsed) || parsed <= 0) return;
    startTransition(async () => {
      await addManualEntryAction({
        personKey: person,
        label: trimmed,
        points: Math.round(parsed),
        source: "nachtrag",
      });
      setLabel("");
      setPoints("");
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Erledigt nachtragen"
        className="shrink-0 w-7 h-7 grid place-items-center rounded-full text-ink-soft dark:text-cream/55 bg-cream/70 dark:bg-white/[0.05] hover:bg-cream dark:hover:bg-white/10 text-[15px] leading-none transition-colors"
      >
        +
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Erledigt …"
        autoFocus
        className="w-28 text-[12.5px] bg-cream/60 dark:bg-white/[0.05] rounded-lg px-2 py-1 outline-none text-ink dark:text-cream/90 placeholder:text-ink-faint"
      />
      <input
        type="number"
        min={1}
        inputMode="numeric"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        placeholder="Min"
        className="w-12 text-[12.5px] bg-cream/60 dark:bg-white/[0.05] rounded-lg px-2 py-1 outline-none tabular-nums text-ink dark:text-cream/90 placeholder:text-ink-faint"
      />
      <button
        type="submit"
        disabled={pending || !label.trim() || !points}
        className="text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-ink text-cream dark:bg-cream dark:text-ink disabled:opacity-40"
      >
        ✓
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Abbrechen" className="text-ink-faint px-1">✕</button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AddDoneInline.tsx
git commit -m "feat(tasks): compact per-person 'nachtragen' control"
```

---

## Task 5: Long-Press-Menü an der Aufgabe

**Files:**
- Create: `web/src/components/TaskActionMenu.tsx`
- Modify: `web/src/components/tiles.tsx`

`TaskRow` bekommt Long-Press (Touch + Maus). Bei Auslösung öffnet sich `TaskActionMenu` mit drei Aktionen. Aktionen rufen Callbacks, die `TaskTile` an die Server-Actions bindet.

- [ ] **Step 1: `TaskActionMenu` schreiben**

```tsx
"use client";

/** Popover-Menü an einer Aufgabe (durch Long-Press geöffnet). */
export function TaskActionMenu({
  onDone,
  onDefer,
  onFail,
  onClose,
}: {
  onDone: () => void;
  onDefer: () => void;
  onFail: () => void;
  onClose: () => void;
}) {
  const Item = ({ label, run }: { label: string; run: () => void }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        run();
        onClose();
      }}
      className="w-full text-left px-3 py-2.5 text-[14px] text-ink dark:text-cream/90 hover:bg-cream dark:hover:bg-white/5 transition-colors"
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="absolute z-20 left-8 top-8 w-52 rounded-xl bg-white dark:bg-[#26241F] shadow-card ring-1 ring-black/10 dark:ring-white/10 overflow-hidden divide-y divide-black/5 dark:divide-white/5">
        <Item label="✓ Erledigt" run={onDone} />
        <Item label="→ Aufschieben" run={onDefer} />
        <Item label="✕ Geht heute nicht" run={onFail} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: `TaskRow` um Long-Press erweitern**

In `web/src/components/tiles.tsx`, oben `"use client";` ergänzen (Datei wird interaktiv) und Imports:

```tsx
"use client";

import { useRef, useState } from "react";
import { TaskActionMenu } from "@/components/TaskActionMenu";
```

`TaskRow`-Signatur erweitern um `onDefer`/`onFail`:

```tsx
export function TaskRow({
  task,
  onToggle,
  onDefer,
  onFail,
}: {
  task: Task;
  onToggle: (id: string) => void;
  onDefer: (id: string) => void;
  onFail: (id: string) => void;
}) {
```

Im Funktionskörper vor dem `return` Long-Press-Handling:

```tsx
  const [menuOpen, setMenuOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const startPress = () => {
    if (!interactive) return;
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      setMenuOpen(true);
    }, 500);
  };
  const cancelPress = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const handleClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return; // Long-Press hat Menü geöffnet — Tap nicht als Toggle werten
    }
    if (interactive) onToggle(task.id);
  };
```

Das `<li>` umstellen: `onClick={handleClick}` (statt der bisherigen Inline-Bedingung) plus Press-Handler und `relative`:

```tsx
    <li
      className={`group relative flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-2xl transition-colors ${
        interactive ? "hover:bg-cream/70 dark:hover:bg-white/[0.03] cursor-pointer" : ""
      }`}
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
    >
```

Direkt nach dem öffnenden `<li ...>` das Menü bedingt rendern:

```tsx
      {menuOpen && (
        <TaskActionMenu
          onDone={() => onToggle(task.id)}
          onDefer={() => onDefer(task.id)}
          onFail={() => onFail(task.id)}
          onClose={() => setMenuOpen(false)}
        />
      )}
```

- [ ] **Step 3: `TaskTile` durchreichen + „+"-Header**

`TaskTile`-Signatur erweitern und `AddDoneInline` einbinden:

```tsx
import { AddDoneInline } from "@/components/AddDoneInline";
```

```tsx
export function TaskTile({
  person,
  tasks,
  sub,
  onToggle,
  onDefer,
  onFail,
}: {
  person: "dome" | "emely";
  tasks: Task[];
  sub?: string;
  onToggle: (id: string) => void;
  onDefer: (id: string) => void;
  onFail: (id: string) => void;
}) {
```

Im `CardHead` das `right` so ändern, dass Zähler + „+" nebeneinander stehen:

```tsx
        right={
          <div className="flex items-center gap-2">
            <span className={`shrink-0 text-[12px] font-semibold px-2.5 py-1 rounded-full ${p.soft} ${p.text}`}>
              {openCount} offen
            </span>
            <AddDoneInline person={person} />
          </div>
        }
```

Und die `TaskRow`-Schleife um die neuen Props erweitern:

```tsx
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={onToggle} onDefer={onDefer} onFail={onFail} />
        ))}
```

`<ul className="-my-1">` → `<ul className="-my-1 overflow-y-auto">` (internes Scrollen, falls viele Aufgaben). Die Höhe begrenzt der Grid-Container in Task 7.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `dashboard.tsx` ruft `TaskTile` noch ohne `onDefer`/`onFail`. Das wird in Task 7 behoben. (Zwischenzustand ok; nicht committen, bis Task 7 grün ist — oder hier provisorisch in Task 7 fortfahren.)

> Hinweis: Task 5 und Task 7 zusammen committen, da `TaskTile`-Signatur und `dashboard.tsx` zusammengehören.

---

## Task 6: Topbar-Kennzahl-Chips `TopbarStats`

**Files:**
- Create: `web/src/components/TopbarStats.tsx`

Kompakte, nicht-interaktive Chips aus `openTaskCount` + `project` (Daten wie bisher in `WeekWidget`).

- [ ] **Step 1: Komponente schreiben**

```tsx
import type { ProjectProgress } from "@/lib/repositories/projects";

/** Schlanke Kennzahl-Chips für die Topbar (offene Aufgaben, Projekt-Fortschritt). */
export function TopbarStats({
  openTaskCount,
  project,
}: {
  openTaskCount: number;
  project: ProjectProgress | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 justify-center text-[12.5px] font-medium">
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cream/70 dark:bg-white/[0.05] text-ink-soft dark:text-cream/70">
        📊 <b className="tabular-nums text-ink dark:text-cream">{openTaskCount}</b> offene Aufgaben
      </span>
      {project && (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dome-tint dark:bg-dome/10 text-dome-deep dark:text-dome">
          {project.icon} {project.title} · <b className="tabular-nums">{project.pct}%</b>
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + Commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add web/src/components/TopbarStats.tsx
git commit -m "feat(dashboard): compact topbar stat chips"
```

---

## Task 7: Viewport-Grid-Shell + Verdrahtung

**Files:**
- Modify: `web/src/components/widgets.tsx`
- Modify: `web/src/components/dashboard.tsx`
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: `MealPlanWidget` read-only machen**

In `web/src/components/widgets.tsx` den `MealPlanControl`-Import entfernen und im `MealPlanWidget`-`CardHead` das `right`-Prop streichen:

```tsx
      <CardHead eyebrow="Essensplan · Woche" title="Schnell & einfach" />
```

`<ul className="space-y-1.5">` → `<ul className="space-y-1.5 overflow-y-auto">`.

- [ ] **Step 2: Dashboard-Shell neu schreiben**

`web/src/components/dashboard.tsx` — Imports bereinigen (entfällt: `ShoppingWidget`, `MealDraftPanel`, `FreshShoppingControl`, `VaultIngestControl`, `WeatherBabyTile`, `ElternzeitStripe`, `AddDoneEntry`, `WeekWidget`, `toggleFreshnessAction`, `toggleShoppingAction`). Neu: `Weather`, `TopbarStats`, `deferTaskAction`, `failTaskAction`.

Neue `DashboardProps` (nur noch genutzte Felder):

```tsx
export interface DashboardProps {
  initialTasks: Task[];
  weather: CurrentWeather;
  appointments: Appointment[];
  meals: Meal[];
  notes: Note[];
  project: ProjectProgress | null;
  openTaskCount: number;
  todayLabel: { weekday: string; date: string };
}
```

Body — `shopping`/`fresh`-State und deren Handler entfallen. Task-Handler ergänzen:

```tsx
  const deferTask = (id: string) => {
    startTransition(async () => {
      await deferTaskAction(id);
    });
  };
  const failTask = (id: string) => {
    startTransition(async () => {
      await failTaskAction(id, "geht heute nicht");
    });
  };
```

(`failTaskAction(id, reason)` existiert bereits in `@/app/actions/tasks`.)

Render — Viewport-Grid:

```tsx
  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col gap-3 p-3 sm:p-4">
      {/* Zone 1 — Topbar */}
      <section className="h-[15%] min-h-0 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr] gap-3">
        <div className="flex flex-col justify-center">
          <Header dark={dark} setDark={setDark} todayLabel={todayLabel} />
        </div>
        <TopbarStats openTaskCount={openTaskCount} project={project} />
        <Weather weather={weather} />
      </section>

      {/* Zone 2 — Primär */}
      <section className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="min-h-0 overflow-hidden">
          <TaskTile person="dome" tasks={domeTasks} onToggle={toggleTask} onDefer={deferTask} onFail={failTask} />
        </div>
        <div className="min-h-0 overflow-hidden">
          <TaskTile person="emely" tasks={emelyTasks} onToggle={toggleTask} onDefer={deferTask} onFail={failTask} />
        </div>
        <div className="min-h-0 overflow-hidden">
          <AppointmentsTile appointments={appointments} />
        </div>
        <div className="min-h-0 overflow-hidden">
          <MealPlanWidget meals={meals} />
        </div>
      </section>

      {/* Zone 3 — Notizen (read-only) */}
      <section className="h-[22%] min-h-0 overflow-hidden">
        <NotesWidget notes={notes} />
      </section>
    </div>
  );
```

> `Header` wird in die Topbar gezogen; den bisherigen `mb-6`-Abstand im `Header` ignoriert das Grid. Falls `Header` zu hoch wirkt, in einem Folgeschritt die Margin reduzieren — nicht blockierend.

Außerdem `Card` muss die Höhe füllen, damit internes Scrollen greift: in `@/components/ui` hat `Card` vermutlich festes Padding; sicherstellen, dass die Kachel `h-full flex flex-col` nutzt. Minimal-invasiv: im Dashboard die Wrapper-`div`s tragen `min-h-0 overflow-hidden`, die Listen in den Kacheln (`overflow-y-auto` aus Task 5/Step-1) scrollen.

- [ ] **Step 3: `page.tsx` Props ausdünnen**

In `web/src/app/page.tsx` die nicht mehr genutzten Loader/Props entfernen: `getShoppingItems`, `getFreshShoppingState`, `getDraftMealPlan`, `listRecipes`, `getComputedSplit`, `getActivePhase`, `babyAge`/`BABY`. `Promise.all` und das `<Dashboard .../>`-Prop-Set auf die neue `DashboardProps`-Menge reduzieren:

```tsx
  const [domeTasks, emelyTasks, appointments, meals, notes, project, openTaskCount] =
    await Promise.all([
      getTasksByPerson("dome", today),
      getTasksByPerson("emely", today),
      getTodaysEvents(today),
      getWeekMealPlan(),
      getNotes(),
      getActiveProjectProgress(),
      getOpenTaskCount(),
    ]);
```

```tsx
  return (
    <Dashboard
      initialTasks={[...domeTasks, ...emelyTasks]}
      weather={weather}
      appointments={appointments}
      meals={meals}
      notes={notes}
      project={project}
      openTaskCount={openTaskCount}
      todayLabel={todayLabel}
    />
  );
```

(Wetter-Block `getCurrent()` mit Fallback bleibt unverändert.)

- [ ] **Step 4: Typecheck + Volltest**

Run: `npm run typecheck && npx vitest run`
Expected: beide grün. Bei „unused import/var" in `page.tsx`/`dashboard.tsx` die übrig gebliebenen Importe entfernen, bis ESLint/TSC sauber sind (`npm run lint`).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/widgets.tsx web/src/components/dashboard.tsx web/src/components/tiles.tsx web/src/components/TaskActionMenu.tsx web/src/app/page.tsx
git commit -m "feat(dashboard): compact one-screen tablet layout"
```

---

## Task 8: Visuelle Verifikation am Tablet

**Files:** keine (Build + Betrieb).

- [ ] **Step 1: Tablet-Build**

Per SSH (siehe Memory: `ssh -p 8022 u0_a353@<tablet-ip>`):

```bash
cd ~/haushalts-dashboard && git stash push -m allowscripts web/package.json; git pull --ff-only; git stash pop
cd web && npx next build --webpack
```
Expected: Build erfolgreich, `/` als `ƒ (Dynamic)`.

- [ ] **Step 2: Neustart + Prüfen**

```bash
bash ~/restart-dashboard.sh
```
Dann am Tablet (Chrome/PWA) öffnen und prüfen:
- **Kein Seiten-Scroll**, alles auf einem Screen (Querformat).
- Wetter-Kachel zeigt Temp/H-T/Regen/Wind, **kein** Baby-Inhalt.
- Tippen auf Aufgabe = erledigt; **Halten** öffnet Menü (Erledigt/Aufschieben/Geht nicht).
- „Aufschieben" → Aufgabe verschwindet aus „heute" (Status moved, neues Datum).
- „+" im Personen-Header öffnet Nachtragen.
- Einkauf/Fairness/Baby/Admin/Footer **weg**.

- [ ] **Step 3: Commit (nur falls Feinjustage am Code nötig war)**

```bash
git add -A && git commit -m "fix(dashboard): tablet layout adjustments"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Viewport-Grid (T7), Wetter+Wind ohne Baby (T1/T2/T7), Primär-4/Notiz-Band (T7), Tippen/Halten-Menü (T5), Nachtragen „+" (T4), Aufschieben=auto Tag (T3), Entfernen von Einkauf/Fairness/Planung/Admin (T7). Alle Spec-Punkte abgedeckt.
- **Platzhalter:** keine; jeder Code-Schritt enthält konkreten Code.
- **Typkonsistenz:** `CurrentWeather.wind` (T1) → genutzt in `Weather` (T2). `nextSensibleDay` (T3) → `deferTask` (T3) → `deferTaskAction` (T3) → `deferTask`-Handler (T7). `TaskTile`-Props `onDefer/onFail` (T5) ↔ Aufrufe in `dashboard.tsx` (T7). `addManualEntryAction`-Signatur aus `AddDoneEntry` übernommen (T4).
- **Reihenfolge-Hinweis:** Task 5 lässt den Typecheck rot, bis Task 7 die `dashboard.tsx`-Aufrufe nachzieht; daher Task 5+7 als zusammenhängender Commit (in T7/Step 5 enthalten).
